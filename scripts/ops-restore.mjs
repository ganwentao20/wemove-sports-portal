import { args, restore } from "./ops-backup-lib.mjs";
try {
  console.log(JSON.stringify(await restore(args())));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
