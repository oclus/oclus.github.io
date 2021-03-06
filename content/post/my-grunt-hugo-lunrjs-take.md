---
title: "My Grunt Hugo Lunrjs Take"
date: 2021-03-07T01:27:15+08:00
draft: false
tags: ["tutorial", "hugo"]
---

This tutorial is based on [sebz's Hugo search tutorial](https://gist.github.com/sebz/efddfc8fdcb6b480f567) among others in the comment section with my own minor modification for this blog site.

> How to implement a custom search for [Hugo](http://gohugo.io) usig [Gruntjs](http://gruntjs.com) and [Lunrjs](http://lunrjs.com).

## Requirements

Install the following tools:

* [Nodejs](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager)
* [Gruntjs](http://gruntjs.com/getting-started)

Install `npm install --save-dev grunt-cli` to save the Grunt binary locally, and add the script below to run `npm run index` for generating the index json file when updating contents folder.

```json
    ...
    "scripts": {
        "index": "node_modules/.bin/grunt lunr-index"
    },
    ...
```

## Setup

### Project organization

Here is my Hugo based website project structure

```
    oclus.github.io/ <= Hugo project root folder
        |- content/
        |- layout/
        |- static/
            |- js/
                |- lunr/ <= Where we generate the lunr json index file
                |- vendor/
                    |- lunrjs.min.js <= lunrjs library
                |- ...
        |- config.yaml
        |- ...
        |- Gruntfile.js <= Where the magic happens
        |- package.json <= Dependencies declaration required to build the index
        |- ...
```

### Install the Nodejs dependencies

From the project root folder launch `npm install --save-dev grunt string yaml`

* [string](http://stringjs.com/) <= do almost all the work
* [yamljs](https://www.npmjs.com/package/yamljs)
    - Used to parse the Frontmatter, mine is in YAML

## Time to work

### The principle

We will work both at buildtime and runtime. With Gruntjs (buildtime), we'll generate a JSON index file and with a small js script (runtime) initilize and use lunrjs.

### Build the Lunr index file

Lunrjs allows you to define fields to describe your pages (documents in lunrjs terms) that will be used to search and hopefully find stuff. The index file is basically a JSON file corresponding to an array of all the documents (pages) composing the website.

Here are the fields I chose to describe my pages:

* `title` <=> Frontmatter title or file name
* `tags` <=> Frontmatter tags or nothing
* `content` <=> File content
* `ref` <=> Reworked file path used as absolute URL

#### Workflow

1. Recursively walk through all files of the `content` folder
2. Two possibilities
    1. Markdown file
        1. Parse the Frontmatter to extract the `title` and the `tags`
        2. Parse and clean the content
    2. HTML file
        1. Parse and clean the content
        2. Use the file name as `title`
3. Use the path file as `ref` (link toward the page)

#### Show me the code!

Here is the `Gruntfile.js` file:

```js

var yaml = require("yamljs");
var S = require("string");

var CONTENT_PATH_PREFIX = "content";

module.exports = function(grunt) {

    grunt.registerTask("lunr-index", function() {

        grunt.log.writeln("Build pages index");

        var indexPages = function() {
            var pagesIndex = [];
            grunt.file.recurse(CONTENT_PATH_PREFIX, function(abspath, rootdir, subdir, filename) {
                grunt.verbose.writeln("Parse file:",abspath);
                pagesIndex.push(processFile(abspath, filename));
            });

            return pagesIndex;
        };

        var processFile = function(abspath, filename) {
            var pageIndex;

            if (S(filename).endsWith(".html")) {
                pageIndex = processHTMLFile(abspath, filename);
            } else {
                pageIndex = processMDFile(abspath, filename);
            }

            return pageIndex;
        };

        var processHTMLFile = function(abspath, filename) {
            var content = grunt.file.read(abspath);
            var pageName = S(filename).chompRight(".html").s;
            var href = S(abspath)
                .chompLeft(CONTENT_PATH_PREFIX).s;
            return {
                title: pageName,
                href: href,
                content: S(content).trim().stripTags().stripPunctuation().s
            };
        };

        var processMDFile = function(abspath, filename) {
            var content = grunt.file.read(abspath);
            var pageIndex;
            // First separate the Front Matter from the content and parse it
            // Note that yaml is `---`
            content = content.split("---");
            var frontMatter;
            try {
                frontMatter = yaml.parse(content[1].trim());
            } catch (e) {
                conzole.failed(e.message);
            }

            var href = S(abspath).chompLeft(CONTENT_PATH_PREFIX).chompRight(".md").s;
            // href for index.md files stops at the folder name
            if (filename === "index.md") {
                href = S(abspath).chompLeft(CONTENT_PATH_PREFIX).chompRight(filename).s;
            }

            // Build Lunr index for this page
            pageIndex = {
                title: frontMatter.title,
                tags: frontMatter.tags,
                href: href,
                content: S(content[2]).trim().stripTags().stripPunctuation().s
            };

            return pageIndex;
        };

        grunt.file.write("site/static/js/lunr/pages-index.json", JSON.stringify(indexPages()));
        grunt.log.ok("Index built");
    });
};

```

The index file is similar like this:

```js
[{
    "title": "Page1",
    "href": "/section/page1",
    "content": " This is the cleaned content of 'site/content/section/page1.md' "
}, {
    "title": "Page2",
    "tags": ["tag1", "tag2", "tag3"],
    "href": "/section/page2",
    "content": " This is the cleaned content of 'site/content/section/page2.md' "
}, {
    "title": "Page3",
    "href": "/section/page3",
    "content": " This is the cleaned content of 'site/content/section/page3.md' "
}]
```

Launch the task `npm run index` to auto-generate the `pages-index.json` file

### Use the index

Paste this client-side snippet where there should be `<input id="search" ...>` and `<ul id="results"></ul>`.
Make sure the following below are all in the same page.

```html
...
<input id="search" type="text">
...
<ul id="results"></ul>
...
<script type="text/javascript" src="js/vendor/lunr.min.js"></script>
<script type="text/javascript">
    var lunrIndex,
        $results,
        pagesIndex;

    // Initialize lunrjs using our generated index file
    function initLunr() {
        var request = new XMLHttpRequest();
        request.open('GET', 'js/lunr/pages-index.json', true);

        request.onload = function() {
            if (request.status >= 200 && request.status < 400) {

                pagesIndex = JSON.parse(request.responseText);

                // Set up lunrjs by declaring the fields we use
                // Also provide their boost level for the ranking
                lunrIndex = lunr(function() {
                    this.field("title", {
                        boost: 10
                    });
                    this.field("tags", {
                        boost: 5
                    });
                    this.field("content");

                    // ref is the result item identifier (I chose the page URL)
                    this.ref("href");
                    for (var i = 0; i < pagesIndex.length; ++i) {
                        this.add(pagesIndex[i]);
                    }
                });
            } else {
                var err = textStatus + ", " + error;
                console.error("Error getting Hugo index flie:", err);
            }
        };

        request.send();
    }

    // Nothing crazy here, just hook up a event handler on the input field
    function initUI() {
        $results = document.getElementById("results");
        $search = document.getElementById("search");
        $search.onkeyup = function() {
            while ($results.firstChild) {
                $results.removeChild($results.firstChild);
            }

            // Only trigger a search when 2 chars. at least have been provided
            var query = $search.value;
            if (query.length < 2) {
                return;
            }

            //add some fuzzyness to the string matching to help with spelling mistakes.
            var fuzzLength = Math.round(Math.min(Math.max(query.length / 4, 1), 3));
            var fuzzyQuery = query + '~' + fuzzLength;

            var results = search(fuzzyQuery);
            renderResults(results);
        };
    }

    /**
     * Trigger a search in lunr and transform the result
     *
     * @param  {String} query
     * @return {Array}  results
     */
    function search(query) {
        // Find the item in our index corresponding to the lunr one to have more info
        // Lunr result: 
        //  {ref: "/section/page1", score: 0.2725657778206127}
        // Our result:
        //  {title:"Page1", href:"/section/page1", ...}
        return lunrIndex.search(query).map(function(result) {
            return pagesIndex.filter(function(page) {
                return page.href === result.ref;
            })[0];
        });
    }

    /**
     * Display the 10 first results
     *
     * @param  {Array} results to display
     */
    function renderResults(results) {
        if (!results.length) {
            return;
        }

        // Only show the ten first results
        $results = document.getElementById("results");
        results.slice(0, 10).forEach(function(result) {
            var li = document.createElement('li');
            var ahref = document.createElement('a');
            ahref.href = result.href;

            // design your list if necessary
            ahref.text = `${result.title} - ${result.content}`;
            li.append(ahref);
            $results.appendChild(li);
        });
    }

    // Let's get started
    initLunr();

    document.addEventListener("DOMContentLoaded", function() {
        initUI();
    })
</script>
```

This post is unlicensed following the original post, so, feel free to copy paste.