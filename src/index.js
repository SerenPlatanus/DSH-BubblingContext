import { z } from 'zod';
import lineage from './lineage.cjs';
export const name = 'bubbling-context';
export const inject = ['sessionProjections'];
const schema=z.object({parentSession:z.string().nullable(),inheritedEventCount:z.number().int().nonnegative(),
  seeded:z.boolean(),provider:z.string().nullable(),children:z.array(z.object({id:z.string(),mode:z.string(),label:z.string(),catalogSeq:z.number(),callId:z.string().nullable(),callSeq:z.number().nullable(),anchorConfirmed:z.boolean()})),
  calls:z.array(z.object({id:z.string(),name:z.string(),seq:z.number(),active:z.boolean()})),
  usage:z.object({input:z.number(),output:z.number(),cacheRead:z.number(),cacheWrite:z.number(),total:z.number(),calls:z.number(),cacheReported:z.boolean()})});
export function apply(ctx) {
  ctx.sessionProjections.register({key:lineage.KEY,stateVersion:2,stateSchema:schema,
    init:lineage.initLineage,apply:lineage.foldLineage,wire:{viewSchema:schema,view:state=>state}});
}
