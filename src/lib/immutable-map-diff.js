// curated
import { Set, Map } from "immutable";

/**
 * Given two immutable maps, this function provides a shallow diff broken down
 * into two maps from keys to created and modified values, as well as a set
 * of deleted keys.
 * @param {Map} fromMap - previous map from ID to value
 * @param {Map} toMap - current map from ID to value
 * @return {[Map, Map, Set]} - adds, updates, and deletes
 */
export default function shallowImmutableMapDiff (fromMap, toMap) {
  if (!fromMap) {
    return [toMap || Map(), Map(), Set()];
  }
  if (!toMap) {
    return [Map(), Map(), Set.fromKeys(fromMap.keySeq())];
  }
  const added = toMap.filter((v, k) => !fromMap.get(k));
  const updated = toMap.filter((v, k) => ((fromMap.get(k) || v) !== v));
  const removed = fromMap.filter((v, k) => !toMap.get(k));
  return [added, updated, removed];
}
