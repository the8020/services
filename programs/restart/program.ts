import { lifecycle } from "../../src/commands.ts";
export default (...args: string[]) => lifecycle("restart", args);
