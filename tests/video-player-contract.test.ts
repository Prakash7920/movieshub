import assert from "node:assert/strict";
import React from "react";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { VideoPlayer, type VideoPlayerProps } from "../components/player/video-player";

type Assert<T extends true> = T;
type RawSourcePropIsNotAccepted = Assert<"src" extends keyof VideoPlayerProps ? false : true>;
const rawSourcePropIsNotAccepted: RawSourcePropIsNotAccepted = true;

test("player contract does not accept a caller-supplied raw src prop", () => {
  assert.equal(rawSourcePropIsNotAccepted, true);
});

test("player renders a fail-closed shell without video or source elements", () => {
  const markup = renderToStaticMarkup(
    React.createElement(VideoPlayer, { title: "NexaFilm security test" }),
  );

  assert.match(markup, /Playback disabled/);
  assert.match(markup, /Secure delivery pending/);
  assert.doesNotMatch(markup, /<video\b/i);
  assert.doesNotMatch(markup, /<source\b/i);
  assert.doesNotMatch(markup, /controlsList|autoplay|src=/i);
});
