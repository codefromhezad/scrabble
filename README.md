# Scrabble clone


## Requirements

Most of this thing only uses a bunch of Javascript, HTML and CSS. Although, for efficiency purposes, the spell-checking is done server-side.

TL;DR; You'll need :
* A Webserver (Apache, Nginx, you-name-it) configured to run PHP scripts.
* PHP (Any version above 5.2 or 5.3 should be fine)
* An up-to-date brower (as of Septembre 2017)
* GNU's `aspell` binary (Since I'm coding on a mac right now, the following instructions are only tested on OSX, but as far as I know, the binary is available from almost every package manager and once installed, it should work fine. If you're on Windows, it shouldn't be too hard either but I can't help you).



## Installing GNU's aspell on OSX

1) Install the binary using `brew`. <sup><a id="osx_aspell_install_ref" href="#osx_aspell_install_note">(see note 1)</a></sup>
```bash
brew install aspell
```

2) Type the next command to find to full path to the `aspell` binary on your system
```bash
which aspell
```
and copy the path you get to set the `ASPELL_PATH` value in the file `server/conf.php`.


## Log Book 

Date 			| Log
----------------|------------------------
September 2017 	| Looks like this Scrabble clone is actually pretty close to be playable !
August 2017		| Just some code I'll probably never finish for fun.




## Footnotes

**<a id="osx_aspell_install_note">Note 1</a> :** As of September 2017, brew installs the next dictionaries along with `aspell` by default : *fr*, *en*, *es* and *de*. If you need to use additionnal languages, type `brew info aspell` in your terminal to see the required parameters to install these dictionaries. 

Please note that right now (still Sep. 2017), the icelandic language dictionnary (`--with-lang-is`) has a UTF-8 bug and will crash the installation. For this reason, as tempting as it is, avoid using the parameter `--with-all-langs`. Maybe it'll be fixed when you'll be reading this, but the more you know ... <a href="#osx_aspell_install_ref">↩</a>