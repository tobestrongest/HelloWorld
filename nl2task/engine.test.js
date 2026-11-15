import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { runAll } = createRequire(import.meta.url)("./engine.js");

function ids(result) {
  return result.calls.map((call) => call.api);
}

const full = runAll("建一个叫 Love Coldplay 的歌单，放入 Coldplay 最热门的歌");
assert.deepEqual(full.slots, { playlistName: "Love Coldplay", artist: "Coldplay" });
for (const result of full.results) {
  assert.deepEqual(ids(result), [
    "search_artist",
    "get_top_tracks",
    "get_current_user",
    "create_playlist",
    "add_tracks",
  ]);
  assert.equal(result.calls.some((call) => call.params.some((param) => param.missing)), false);
}
assert.match(full.results[1].stages[2].body, /search_artist\(name="Coldplay"\)/);

const lookup = runAll("查一下周杰伦的热门歌曲");
assert.equal(lookup.slots.artist, "周杰伦");
assert.deepEqual(ids(lookup.results[0]), ["search_artist", "get_top_tracks"]);
assert.deepEqual(ids(lookup.results[2]), ["search_artist", "get_top_tracks"]);

const emptyPlaylist = runAll("建一个叫通勤的歌单");
assert.equal(emptyPlaylist.slots.playlistName, "通勤");
assert.deepEqual(ids(emptyPlaylist.results[0]), ["get_current_user", "create_playlist"]);
assert.deepEqual(ids(emptyPlaylist.results[2]), ["get_current_user", "create_playlist"]);

const partial = runAll("放入 Coldplay 最热门的歌");
assert.deepEqual(ids(partial.results[0]), ["search_artist", "get_top_tracks", "add_tracks"]);
const missing = partial.results[0].calls.at(-1).params.find((param) => param.name === "playlist_id");
assert.equal(missing.missing, true);
assert.deepEqual(ids(partial.results[1]), [
  "search_artist",
  "get_top_tracks",
  "get_current_user",
  "create_playlist",
  "add_tracks",
]);
assert.match(partial.results[1].stages[1].body, /补上 create_playlist/);
assert.deepEqual(ids(partial.results[2]), ["search_artist", "get_top_tracks"]);

const album = runAll("看一下专辑 Abbey Road 里的歌");
assert.equal(album.slots.album, "Abbey Road");
assert.deepEqual(ids(album.results[2]), ["search_album", "get_album_tracks"]);

const unknown = runAll("今天天气怎么样");
for (const result of unknown.results) assert.deepEqual(result.calls, []);

const blank = runAll("   ");
for (const result of blank.results) assert.deepEqual(result.calls, []);

console.log("engine tests passed");
