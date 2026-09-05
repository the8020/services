import {
  buildIndex,
  type IndexScope,
  type IndexState,
} from "../../src/indexing.ts";

export default function (state: IndexState, scope: Readonly<IndexScope>) {
  return buildIndex(state, scope);
}
