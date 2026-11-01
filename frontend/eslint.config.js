import js from '@eslint/js'
import react from 'eslint-plugin-react'
import hooks from 'eslint-plugin-react-hooks'
import imports from 'eslint-plugin-import'
import promise from 'eslint-plugin-promise'
import globals from 'globals'
export default [
 { ignores: ['dist/**','android/**','ios/**','node_modules/**','test-results*/**','playwright-report/**','src/data/**','src/assets/**'] },
 js.configs.recommended,
 { files:['**/*.{js,jsx,mjs}'], languageOptions:{ globals:{...globals.browser,...globals.node,...globals.serviceworker}, parserOptions:{ecmaFeatures:{jsx:true}} },
 plugins:{react,'react-hooks':hooks,import:imports,promise},settings:{react:{version:'19.2'},'import/resolver':{typescript:{alwaysTryTypes:true}}},
 rules:{...react.configs.recommended.rules,...react.configs['jsx-runtime'].rules,
 'react/prop-types':'off', // Existing JS components use inferred types; no PropTypes runtime dependency.
 'react-hooks/rules-of-hooks':'error','react-hooks/exhaustive-deps':'error',
 'import/no-unresolved':['error',{ignore:['\\?url$','\\?raw$','\\?coarse-test$']}], 'import/no-duplicates':'error',
 'promise/valid-params':'error','promise/no-return-wrap':'error','promise/no-new-statics':'error',
 'no-unused-vars':['error',{argsIgnorePattern:'^_',caughtErrors:'none',ignoreRestSiblings:true,varsIgnorePattern:'^_'}],
 } },
]
