escher-demo
===========

To get started, clone this repository using git, or download
this [ZIP file](https://github.com/escher/escher-demo/archive/master.zip).

Then, in your favorite terminal, navigate to the folder that contains this
README, and run one of the following commands to start a web server.

```shell
# python 2
python -c "import SimpleHTTPServer; m = SimpleHTTPServer.SimpleHTTPRequestHandler.extensions_map; m[''] = 'text/plain'; m.update(dict([(k, v + ';charset=UTF-8') for k, v in m.items()])); SimpleHTTPServer.test();"

# python 3
python -m http.server

# node.js
http-server -p 8000
```

This will start a unicode-friendly Python web
server. Open [http://localhost:8000/](http://localhost:8000/) to see the demos.

Try editing the `embedded_map_builder/index.html` file, then reload your web
browser to see what you've changed. You can see what's happening under the hood
by opening your Developer tools
([Chrome](https://developer.chrome.com/devtools),
[Firefox](https://developer.mozilla.org/en-US/docs/Tools)). Next, have a look at
the Escher [JavaScript documentation](http://escher.readthedocs.org/) to learn
about the Builder class and its options and methods.

Snippets
--------

The examples in the snippets directory are short code blocks that can be
executed in the Developer Tools for an open Escher map to activate new
features. Each snippet has a description at the beginning of the file. To learn
about the Developer Tools, try these resources:

- Chrome: https://developer.chrome.com/devtools
- Firefox: http://www.howtogeek.com/105320/how-to-use-firefoxs-web-developer-tools/
- Safari: https://developer.apple.com/library/safari/documentation/AppleApplications/Conceptual/Safari_Developer_Guide/GettingStarted/GettingStarted.html
- Internet Explorer/Edge: https://msdn.microsoft.com/library/bg182326

Ideas
-----

- sliders for data
- knockout example
- data (e.g. plots) on hover
- embed in website
- ChemSpider structures on a map
