# Scrabble clone


## Requirements/Installation

Most of this thing only uses a bunch of Javascript, HTML and CSS. Although, for efficiency purposes, the spell-checking is done server-side.

The spell-checking script is coded in PHP and uses GNUS's Aspell. Since I'm coding on a mac right now, the following instructions are specifically made for OSX, but installing the binary should be much *MUCH* easier on a linux box. I mean, I guess.



#### OSX

1) Install the Aspell library and all its default language dictionaries using `brew`. <sup><a id="osx_aspell_install_ref" href="#osx_aspell_install_note">1</a></sup>
```bash
brew install aspell
```




## Log Book 

Date 			| Log
----------------|------------------------
September 2017 	| Looks like this Scrabble clone is actually pretty close to be playable !
August 2017		| Just some code I'll probably never finish for fun.




## Footnotes

**<a id="osx_aspell_install_note">#1</a>** As of September 2017, the default languages are *fr*, *en*, *es* and *de*. If you need to install additionnal languages, type `brew info aspell` in your terminal to see the required parameters to install these dictionaries. 

Please note that right now (still Sep. 2017), the icelandic language dictionnary (`--with-lang-is`) has a UTF-8 bug and will crash the installation. For this reason, as tempting as it is, avoid using the parameter `--with-all-langs`. Maybe it'll be fixed when you'll be reading this, I don't know. <a href="#osx_aspell_install_ref">↩</a>