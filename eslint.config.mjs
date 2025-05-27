import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import { globalIgnores } from 'eslint/config'

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  globalIgnores([
    '**/node_modules',
    '**/dist',
    '**/out',
    '**/.gitignore',
    '**/client'
  ]),
  {
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  }
)
