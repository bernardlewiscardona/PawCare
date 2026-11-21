// Metro resolves bundled .png files to an asset reference for <Image source>.
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';

  const source: ImageSourcePropType;
  export default source;
}
