export function databaseTestInput(source) {
  const tap = /\b(has_function|function_privilege|has_table|has_column|function_security_definer|policy_cmd_is|ok|is|lives_ok|throws_ok)\s*\(/i.test(source)
  if (!tap) return source
  const setup = 'create schema if not exists extensions; create extension if not exists pgtap with schema extensions; set search_path = public, extensions;'
  if (/\bselect\s+(?:\*\s+from\s+)?(?:plan|no_plan)\s*\(/i.test(source)) return `${setup}\n${source}`
  return `begin; ${setup} select no_plan();\n${source}\nselect * from finish(); rollback;`
}
export function databaseTestPassed(result) {
  return result.status === 0 && !/^not ok\b|^Bail out!|Looks like you (?:planned|failed|ran)|No tests run|Bad plan/im.test(result.stdout || '')
}
