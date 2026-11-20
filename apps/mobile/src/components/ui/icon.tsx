import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';
import { color as palette } from '@/theme/tokens';

// Line icons exported from Figma (00 Design System → Components → Icons): 24 px, 1.75 stroke.
// The stroke is compiled to `currentColor` (.svgrrc.json), so `color` recolours it.
import AlertTriangle from '../../../assets/icons/alert-triangle.svg';
import Archive from '../../../assets/icons/archive.svg';
import ArrowLeft from '../../../assets/icons/arrow-left.svg';
import ArrowRight from '../../../assets/icons/arrow-right.svg';
import ArrowUpRight from '../../../assets/icons/arrow-up-right.svg';
import Bell from '../../../assets/icons/bell.svg';
import BellOff from '../../../assets/icons/bell-off.svg';
import Cake from '../../../assets/icons/cake.svg';
import Calendar from '../../../assets/icons/calendar.svg';
import Camera from '../../../assets/icons/camera.svg';
import Check from '../../../assets/icons/check.svg';
import ChevronDown from '../../../assets/icons/chevron-down.svg';
import ChevronLeft from '../../../assets/icons/chevron-left.svg';
import ChevronRight from '../../../assets/icons/chevron-right.svg';
import CircleCheck from '../../../assets/icons/circle-check.svg';
import Clock from '../../../assets/icons/clock.svg';
import Download from '../../../assets/icons/download.svg';
import Eye from '../../../assets/icons/eye.svg';
import FileText from '../../../assets/icons/file-text.svg';
import Filter from '../../../assets/icons/filter.svg';
import Globe from '../../../assets/icons/globe.svg';
import Heart from '../../../assets/icons/heart.svg';
import House from '../../../assets/icons/house.svg';
import Image from '../../../assets/icons/image.svg';
import Info from '../../../assets/icons/info.svg';
import Link from '../../../assets/icons/link.svg';
import Lock from '../../../assets/icons/lock.svg';
import LogOut from '../../../assets/icons/log-out.svg';
import Mail from '../../../assets/icons/mail.svg';
import MapPin from '../../../assets/icons/map-pin.svg';
import Minus from '../../../assets/icons/minus.svg';
import MoreHorizontal from '../../../assets/icons/more-horizontal.svg';
import Package from '../../../assets/icons/package.svg';
import Paperclip from '../../../assets/icons/paperclip.svg';
import PawPrint from '../../../assets/icons/paw-print.svg';
import Pencil from '../../../assets/icons/pencil.svg';
import Phone from '../../../assets/icons/phone.svg';
import Pill from '../../../assets/icons/pill.svg';
import Plus from '../../../assets/icons/plus.svg';
import Repeat from '../../../assets/icons/repeat.svg';
import RotateCcw from '../../../assets/icons/rotate-ccw.svg';
import RotateCw from '../../../assets/icons/rotate-cw.svg';
import Scan from '../../../assets/icons/scan.svg';
import Search from '../../../assets/icons/search.svg';
import Settings from '../../../assets/icons/settings.svg';
import Sliders from '../../../assets/icons/sliders.svg';
import Smartphone from '../../../assets/icons/smartphone.svg';
import Stethoscope from '../../../assets/icons/stethoscope.svg';
import Syringe from '../../../assets/icons/syringe.svg';
import Trash from '../../../assets/icons/trash.svg';
import Upload from '../../../assets/icons/upload.svg';
import User from '../../../assets/icons/user.svg';
import Weight from '../../../assets/icons/weight.svg';
import X from '../../../assets/icons/x.svg';

const icons = {
  'alert-triangle': AlertTriangle,
  archive: Archive,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  bell: Bell,
  'bell-off': BellOff,
  cake: Cake,
  calendar: Calendar,
  camera: Camera,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'circle-check': CircleCheck,
  clock: Clock,
  download: Download,
  eye: Eye,
  'file-text': FileText,
  filter: Filter,
  globe: Globe,
  heart: Heart,
  house: House,
  image: Image,
  info: Info,
  link: Link,
  lock: Lock,
  'log-out': LogOut,
  mail: Mail,
  'map-pin': MapPin,
  minus: Minus,
  'more-horizontal': MoreHorizontal,
  package: Package,
  paperclip: Paperclip,
  'paw-print': PawPrint,
  pencil: Pencil,
  phone: Phone,
  pill: Pill,
  plus: Plus,
  repeat: Repeat,
  'rotate-ccw': RotateCcw,
  'rotate-cw': RotateCw,
  scan: Scan,
  search: Search,
  settings: Settings,
  sliders: Sliders,
  smartphone: Smartphone,
  stethoscope: Stethoscope,
  syringe: Syringe,
  trash: Trash,
  upload: Upload,
  user: User,
  weight: Weight,
  x: X,
} satisfies Record<string, FC<SvgProps>>;

export type IconName = keyof typeof icons;

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

/** Decorative line icon. Give the surrounding control the accessible label, not the icon. */
export function Icon({ name, size = 24, color = palette.text.primary }: IconProps) {
  const Svg = icons[name];
  return (
    <Svg
      width={size}
      height={size}
      color={color}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
