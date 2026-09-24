import js from '@eslint/js'

// This codebase is deliberately terse -- dense one-liners, ASI, no semicolons
// in most files. A style linter would fight that on every line for no benefit.
// The rule set below is narrowed to things that are actual bugs: undefined
// references, unreachable code, duplicate keys, accidental assignment in a
// condition -- the kind of mistake that's easy to miss in a 150-character line
// and that a test suite doesn't always happen to exercise.
export default [
 {
  ignores: ['dist/**', 'node_modules/**', 'public/**']
 },
 {
  ...js.configs.recommended,
  languageOptions: {
   ecmaVersion: 2024,
   sourceType: 'module',
   globals: {
    window: 'readonly', document: 'readonly', navigator: 'readonly',
    localStorage: 'readonly', location: 'readonly', history: 'readonly',
    fetch: 'readonly', Audio: 'readonly', AudioContext: 'readonly',
    requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
    performance: 'readonly', console: 'readonly', setTimeout: 'readonly',
    clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
    URL: 'readonly', URLSearchParams: 'readonly', Image: 'readonly',
    CustomEvent: 'readonly', PointerEvent: 'readonly', WebSocket: 'readonly',
    RTCPeerConnection: 'readonly', globalThis: 'readonly'
   }
  },
  rules: {
   'no-unused-vars': ['warn', {args: 'none', varsIgnorePattern: '^_'}],
   'no-empty': ['error', {allowEmptyCatch: true}],
   'no-fallthrough': 'off',      // the codebase uses intentional fallthrough in a couple of switches
   'no-constant-condition': ['error', {checkLoops: false}]
  }
 },
 {
  files: ['test/**/*.js'],
  languageOptions: {
   globals: {process: 'readonly'}
  }
 }
]
