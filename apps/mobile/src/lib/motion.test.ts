import { describe, expect, it, vi } from 'vitest';
import {
  SCREEN_TRANSITIONS,
  authStepTransition,
  fadeTransition,
  handoffTransition,
  pageTransition,
  screenTransition,
} from './motion';

// motion.ts reads a few React Native APIs at import time; Node can't load React Native itself.
vi.mock('react-native', () => ({
  AccessibilityInfo: {},
  Dimensions: { get: () => ({ width: 400, height: 800 }) },
  Easing: { out: (f: unknown) => f, cubic: (t: number) => t },
}));

declare global {
  interface ImportMeta {
    glob: (
      pattern: string,
      options: { query: '?raw'; import: 'default'; eager: true },
    ) => Record<string, string>;
  }
}

/** Every route file under src/app, keyed by its Expo Router name (e.g. `pets/[id]/index`). */
const ROUTES = Object.fromEntries(
  Object.entries(
    import.meta.glob('../app/**/*.tsx', { query: '?raw', import: 'default', eager: true }),
  )
    .map(([file, source]) => [file.replace('../app/', '').replace(/\.tsx$/, ''), source] as const)
    // Layouts aren't screens; tab screens switch inside (tabs) with their own transition.
    .filter(([name]) => !name.endsWith('_layout') && !name.startsWith('(tabs)/')),
);
ROUTES['(tabs)'] = '';

const FORMS =
  /<(ModalHeader|PetForm|MedicalForm|PrescriptionForm|ReminderForm|VaccineForm|VisitForm)\b/;
const opts = { reduceMotion: false, topInset: 50 };

describe('SCREEN_TRANSITIONS', () => {
  it('classifies every stack route, and nothing that isn’t one', () => {
    expect(Object.keys(SCREEN_TRANSITIONS).sort()).toEqual(Object.keys(ROUTES).sort());
  });

  it('makes exactly the screens with a modal header (ModalHeader or a form) tasks', () => {
    for (const [name, source] of Object.entries(ROUTES)) {
      expect([name, SCREEN_TRANSITIONS[name] === 'task']).toEqual([name, FORMS.test(source)]);
    }
  });
});

describe('screenTransition', () => {
  it('pushes pages from the right, with the page below shifting left', () => {
    expect(screenTransition('visits/[id]/index', opts)).toEqual(pageTransition);
    expect(pageTransition.animation).toBe('ios_from_right');
  });

  it('pushes a detail onto a detail of the same type like any page', () => {
    expect(screenTransition('vaccines/[id]/index', opts)).toEqual(pageTransition);
  });

  it('raises tasks from the bottom, swipeable on iOS from the header only', () => {
    expect(screenTransition('visits/new', opts)).toEqual({
      animation: 'slide_from_bottom',
      animationDuration: 400,
      gestureDirection: 'vertical',
      gestureResponseDistance: { bottom: 50 + 64 },
    });
  });

  it('lets a create form slide down onto the record that replaces it', () => {
    // A `pop` replace plays the outgoing form's exit. React Navigation defaults to `push`, so
    // every page a form can be replaced by must ask for `pop`.
    const replacedByForms = [
      'pets/[id]/index',
      'visits/[id]/index',
      'vaccines/[id]/index',
      'prescriptions/[id]/index',
      'records/[id]/index',
      'supplies/[id]',
      'turn-on-reminders',
    ];
    for (const page of replacedByForms) {
      expect([page, screenTransition(page, opts).animationTypeForReplace]).toEqual([page, 'pop']);
    }
  });

  it('moves auth steps forward when one replaces the last', () => {
    for (const step of ['register', 'sign-in', 'profile-setup', 'first-pet']) {
      expect(screenTransition(step, opts)).toEqual(authStepTransition);
    }
    expect(authStepTransition.animationTypeForReplace).toBe('push');
  });

  it('fades into the app and back out to Welcome', () => {
    expect(screenTransition('(tabs)', opts)).toEqual(handoffTransition);
    expect(screenTransition('index', opts)).toEqual(handoffTransition);
    expect(handoffTransition).toMatchObject({ animation: 'fade', animationTypeForReplace: 'push' });
  });

  it('fades the attachment viewer, with no gesture', () => {
    expect(screenTransition('records/[id]/file/[fileId]', opts)).toEqual(fadeTransition);
  });

  it('leaves the developer screen on the platform default', () => {
    expect(screenTransition('dev', opts)).toEqual({});
  });

  it('treats an unknown route as a page', () => {
    expect(screenTransition('somewhere/new-route', opts)).toEqual(pageTransition);
  });

  describe('with reduced motion', () => {
    const reduced = { ...opts, reduceMotion: true };

    it('fades every kind of screen briefly instead of moving it', () => {
      for (const name of Object.keys(SCREEN_TRANSITIONS).filter((n) => n !== 'dev')) {
        expect(screenTransition(name, reduced)).toMatchObject({
          animation: 'fade',
          animationDuration: 150,
        });
      }
    });

    it('keeps the replace direction and the viewer’s disabled gesture', () => {
      expect(screenTransition('(tabs)', reduced).animationTypeForReplace).toBe('push');
      expect(screenTransition('register', reduced).animationTypeForReplace).toBe('push');
      expect(screenTransition('visits/[id]/index', reduced).animationTypeForReplace).toBe('pop');
      expect(screenTransition('records/[id]/file/[fileId]', reduced).gestureEnabled).toBe(false);
    });

    it('drops the task swipe zone along with the slide', () => {
      expect(screenTransition('visits/new', reduced)).toEqual({
        animation: 'fade',
        animationDuration: 150,
      });
    });
  });
});
