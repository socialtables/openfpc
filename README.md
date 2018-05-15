# @socialtables/openfpc - Open Floor Plan Creator

A 2D CAD tool built on React, Three.js, and Immutable. This is an open variant
of Social Tables' floor authoring app, repackaged with Electron and invoked
from your command line.

## Purpose

Social Tables spends a lot of time passing data between immutable state trees
and local mutable state through React component hierarchies. We'd like to share
some of what we've learned about doing this quickly and reliably, many times per
second, to create drawing tools.

## CLI Usage

Installation
```sh
npm i -g electron
npm i @socialtables/openfpc
npm link
openfpc
```

Open a sample floor
```sh
openfpc sample-data/socialtables-hq-v3.json
```

## Functionality

- 2D CAD tool with point / boundary / object manipulation
- loads and saves JSON files, with support for Social Tables V3 floor data
- create points, boundaries, and objects
- supports curved boundaries and multiple boundary types
- select and transform entities in bulk
- undo, redo, copy, paste
- guide snapping
- line snapping with automatic bisection
- object to boundary attachment keeps doors in place when editing walls

## Licensing

Copyright 2018 Social Tables

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
