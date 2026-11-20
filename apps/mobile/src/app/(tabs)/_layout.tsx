import { Tabs } from 'expo-router/js-tabs';
import { FloatingTabBar, type TabMeta } from '@/components/ui/tab-bar';
import { slideTabTransition, useReducedMotion } from '@/lib/motion';
import { color as palette } from '@/theme/tokens';

/** Order and icons follow the Figma "Tab Bar": Home, Health, Visits, Supplies, Inbox. */
const TABS: Record<string, TabMeta> = {
  home: { icon: 'house', label: 'Home' },
  health: { icon: 'stethoscope', label: 'Health' },
  visits: { icon: 'calendar', label: 'Visits' },
  supplies: { icon: 'package', label: 'Supplies' },
  // TODO(RM-04): drive the dot from the unread reminder count.
  inbox: { icon: 'bell', label: 'Inbox', showDot: true },
};

export default function TabsLayout() {
  const reduceMotion = useReducedMotion();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} tabs={TABS} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.bg.screen },
        // Slide between tabs; a plain fade when the system asks to reduce motion.
        ...(reduceMotion ? { animation: 'fade' } : slideTabTransition),
      }}
    >
      {Object.entries(TABS).map(([name, meta]) => (
        <Tabs.Screen key={name} name={name} options={{ title: meta.label }} />
      ))}
    </Tabs>
  );
}
