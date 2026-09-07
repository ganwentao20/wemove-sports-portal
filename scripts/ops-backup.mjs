import { args, backup } from "./ops-backup-lib.mjs";
try {
  console.log(JSON.stringify(await backup(args())));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
