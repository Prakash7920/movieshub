import assert from "node:assert/strict";
import React from "react";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { VideoPlayer, type VideoPlayerProps } from "../components/player/video-player";

type Assert<T extends true> = T;
type RawSourcePropIsNotAccepted = Assert<"src" extends keyof VideoPlayerProps ? false : true>;
type ManifestPropIsNotAccepted = Assert<"manifestUrl" extends keyof VideoPlayerProps ? false : true>;
const rawSourcePropIsNotAccepted: RawSourcePropIsNotAccepted = true;
const manifestPropIsNotAccepted: ManifestPropIsNotAccepted = true;

test("player contract does not accept caller-supplied media URLs", () => {
  assert.equal(rawSourcePropIsNotAccepted, true);
  assert.equal(manifestPropIsNotAccepted, true);
});

test("player renders a fail-closed shell when playback approval is off", () => {
  const markup = renderToStaticMarkup(
    React.createElement(VideoPlayer, {
      title: "NexaFilm security test",
      slug: "security-test",
      playbackEnabled: false,
    }),
  );

  assert.match(markup, /Playback disabled/);
  assert.match(markup, /Secure delivery pending/);
  assert.doesNotMatch(markup, /<video\\b/i);
  assert.doesNotMatch(markup, /<source\\b/i);
  assert.doesNotMatch(markup, /controlsList|autoplay|src=/i);
});

test("approved player shell contains no inline or caller-supplied source before grant fetch", () => {
  const markup = renderToStaticMarkup(
    React.createElement(VideoPlayer, {
      title: "NexaFilm security test",
      slug: "security-test",
      playbackEnabled: true,
    }),
  );

  assert.match(markup, /<video\\b/i);
  assert.match(markup, /controls/);
  assert.doesNotMatch(markup, /<source\\b/i);
  assert.doesNotMatch(markup, /src=/i);
  assert.doesNotMatch(markup, /autoplay/i);
});
