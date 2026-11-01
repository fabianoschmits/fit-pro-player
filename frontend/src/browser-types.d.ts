import 'csstype'
declare module 'csstype' { interface Properties { [variable: `--${string}`]: string | number | undefined } }
declare global {
 interface Navigator { readonly standalone?: boolean }
 interface Window { webkitAudioContext?: typeof AudioContext }
}
export {}
