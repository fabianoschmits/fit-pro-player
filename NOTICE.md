# License and third-party notices

Fit Pro Player modifications — Copyright (C) 2026 Fabiano Schmits.
The application code is licensed under **GNU AGPL-3.0-or-later**; see [LICENSE](LICENSE).

The previous app-store exception is not asserted for this modified distribution. Publishing
native builds through a store requires an independent review of the store terms and licenses.

## Local exercise illustrations

The first ten catalogue exercises use Fit Pro Player's own local SVG sprite sequences. Their
vector paths are stored directly in the application source and do not download a character,
model, raster image or animation at runtime. Other catalogue entries use the local body diagram
described below.

## Body diagram geometry

The muscle outlines the body maps are drawn from (`frontend/src/lib/body-paths.js`) are derived
from [**MuscleMap**](https://github.com/melihcolpan/MuscleMap) by Melih Colpan, used under the
**MIT License** and reproduced below. MuscleMap ships its path data as Swift source rather than
`.svg` files; the paths were converted to a JSON module, its sub-group shapes were dropped, and
nothing else about the artwork was changed.

```
MIT License

Copyright (c) 2026 Melih Colpan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Exercise data & media

Fit Pro Player obtains the exercise metadata and instruction source through
[**hasaneyldrm/exercises-dataset**](https://github.com/hasaneyldrm/exercises-dataset). That
dataset also offers a separate third-party media collection. Neither the dataset content nor
the optional third-party media is covered by Fit Pro Player's AGPL license.

That dataset is itself a redistribution: the content originates from
[**ExerciseDB v1**](https://exercisedb.dev/) by **AscendAPI**. This is verifiable from Fit Pro Player's
own data — the stored media filenames embed ExerciseDB's `exerciseId` (Fit Pro Player's `0001` is
`0001-2gPfomN.jpg`; `2gPfomN` is ExerciseDB's id for "3/4 sit-up"), every metadata field matches,
and the instruction sentences are identical apart from stripped `Step:N ` prefixes. See
[issue #5](https://github.com/hasaneyldrm/exercises-dataset/issues/5) on that dataset.

### Metadata & instruction text

The exercise names, attributes and instructions (English in `frontend/src/lib/exercises-data.js`,
other languages in `frontend/src/instr/`, regenerated via `scripts/build-instructions.mjs`)
originate from ExerciseDB v1 and reach Fit Pro Player through the dataset above, which distributes them
under the MIT license reproduced below. The UI translations and most instruction packs are Fit Pro
Player derivative work. The Brazilian Portuguese instruction pack is generated from the MIT-licensed
`instruction_steps.pt` contribution in `dverzolla/exercises-dataset` at commit
`01823800f6980ec54b6f566d73634551a5125253`; the MIT notice below applies to it.

```
MIT License

Copyright (c) 2026 Hasan Emir Yıldırım

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation and data files (the "Software"),
to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Images & animations — third-party, not MIT and not AGPL

The Gym Visual exercise thumbnails and animations are **not** covered by the MIT license above or
by Fit Pro Player's AGPL. The upstream dataset says it has separate written permission to distribute
the 180×180 media, requires the attribution **© [Gym visual](https://gymvisual.com/)**, and explicitly
states that cloning the dataset does not grant a media licence.

**Fit Pro Player does not redistribute or load that third-party media by default.** Public, mobile,
development and container builds instead render the bundled SVG exercise sequences or the local
body diagram, so there is no broken network dependency and no restricted third-party exercise
artwork in this repository or its build output.

A person who obtains their own licence may set `VITE_CATALOG_MEDIA_ENABLED=1` and configure
`VITE_IMG_BASE` and `VITE_GIF_BASE` to point at media they are authorised to serve. For the bundled Docker stack, the authorised files can stay
untracked in `media/img` and `media/gif` and be served at `/img/` and `/gif/`. Keep the required Gym
Visual attribution visible and follow the rights holder's
[Terms & Conditions](https://gymvisual.com/content/3-terms-and-conditions-of-use). Credits alone do
not replace the required licence or separate written redistribution permission.
