/**
 * Node test shim for `react-native-argon2`.
 *
 * Tests that don't exercise the KDF directly never call this. Tests that DO
 * may stub the export at the module level via `jest.mock`. Default behaviour
 * here throws so accidental use is loud.
 */

export default async function argon2(): Promise<never> {
  throw new Error('react-native-argon2 stub: pass through jest.mock for KDF tests');
}
