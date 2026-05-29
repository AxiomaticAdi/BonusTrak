import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier"

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  // Must come last: disables ESLint rules that conflict with Prettier.
  prettier,
]

export default eslintConfig
