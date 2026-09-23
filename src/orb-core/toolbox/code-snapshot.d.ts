declare module "virtual:orb-code-snapshot" {
  export const meta: { fileCount: number; bytes: number; sha256: string };
  const files: Record<string, string>;
  export default files;
}
