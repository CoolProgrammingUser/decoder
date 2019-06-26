var Standards = { general: { options: { automation: "none" } } };
importScripts("https://epicenterprograms.github.io/standards/behavior/general.js");
var S = Standards.general;

var messenger = {};  // sends information back to the website

var words = [[]];  // holds every English word in arrays in order of increasing word length
var verbs = [[]];  // holds every verb in arrays in order of increasing word length
var ALPHABET = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
var PUNCTUATION = [".", "?", "!", ",", "'", '"', ";", ":", "-", "(", ")", "/"];
var LONERS = [
	["and", "but"],
	["am", "is", "are", "was", "were", "be", "been"],
	["of", "for", "with", "from"]
];
var solutions = [];  // holds all possible solutions
var filtered = {};
var hidden = [];
var solutionIndex = 0;  // holds which solution is to be displayed

function isolate(word) {
	/**
	removes the puctuation from words
	*/
	var newWord = "";
	S.forEach(word, function (character, index) {
		if (character.toLowerCase() != character.toUpperCase()/*|| character=="'"*/) {  // if the character is a letter
			newWord += character;
		} else if (character == "{" && word.indexOf("}", index) > -1) {
			newWord += word.slice(index, word.indexOf("}", index) + 1);
		}/* else {
			// do nothing
			// (gets rid of non-letters)
		} */
	});
	return newWord;
}
function standardize(word) {
	/**
	makes a word have a standard letter pattern
	(alphabetically assigns different letters to different letters and same letters to same letters)
	symbols comprised of {number} are considered one symbol
	examples:
		hello --> abccd
		awesome --> abcdefc
		qxf{32}xb --> abcdbe
	*/
	var uniqueLetters = {};
	S.forEach(word, function (letter, index, word) {
		if (letter.toLowerCase() != letter.toUpperCase()) {
			if (uniqueLetters[letter]) {
				uniqueLetters[letter].push(index);
			} else {
				uniqueLetters[letter] = [index];
			}
		} else if (letter == "{") {
			if (uniqueLetters["~" + word.slice(index + 1, word.indexOf("}", index))]) {
				uniqueLetters["~" + word.slice(index + 1, word.indexOf("}", index))].push(index);
			} else {
				uniqueLetters["~" + word.slice(index + 1, word.indexOf("}", index))] = [index];
			}
		}/* else {
			// do nothing
			// (skips the number between any {}s)
		} */
	});
	var letters = word.split("");
	var index = 0;
	var shift = 0;
	var oldShift;
	S.forEach(uniqueLetters, function (numbers) {  // This could likely be done with a search-and-replace method. (although going straight to the index is probably faster than a searching method)
		numbers.forEach(function (number) {
			if (letters[number + shift].toLowerCase() != letters[number + shift].toUpperCase()) {
				if (index < 26) {
					letters.splice(number + shift, 1, ALPHABET[index]);
				} else {  // This should never happen.
					oldShift = shift;
					shift += ("{" + "{0}").format(index - 26).length;  // two braces can't be back-to-back without doing weird stuff
					letters.splice(number + oldShift, 1, "{" + (index - 26) + "}");
				}
			} else if (letters[number + shift] == "{") {
				oldShift = shift;
				if (index < 26) {
					shift -= letters.indexOf("}", number + shift) - (number + shift);  // This needs to happen first or else the splice changes things.
					letters.splice(number + oldShift, letters.indexOf("}", number + oldShift) - (number + oldShift) + 1, ALPHABET[index]);
				} else {
					shift += ("{" + "{0}").format(index - 26).length - letters.indexOf("}", number + shift) + (number + shift);
					letters.splice(number + oldShift, letters.indexOf("}", number + oldShift) - (number + oldShift) + 1, "{" + (index - 26) + "}");
				}
			}
		});
		index++;
	});
	word = "";
	letters.forEach(function (letter) {
		word += letter;
	});
	return word;
}

function checkSolution(solution) {
	/**
	checks basic grammar of a potential solution
	reduces nonsensical solutions
	*/
	let passes = true;
	//// solution.split(/\.|\?|!/g).forEach(function (sentence) {
		//// if (sentence.trim() != "") {  // ensures sentences ending in punctuation don't fail the solution
			if (solution.length > 3) {  // The text should have a verb if it's longer than 3 words long.
				if (!solution.some(function (solutionWord) {  // if the solution has a verb
					return verbs[solutionWord.length - 1].includes(solutionWord);
				})) {
					passes = false;
				}
			}
		//// }
	//// });
	/*
	solution.split(/\.|\?|!|,|'|"|;|:|-|\(|\)|\//g).forEach(function (phrase) {
		phrase = phrase.split(" ");
		if (phrase.length > 1) {
			//// check whether LONERs are next to each other
		}
	});
	*/
	return passes;
}

self.addEventListener("message", function (message) {
	var time = performance.now();  //// tracks the performance of the decoder
	new Promise(function (resolve, reject) {
		solutions = [];
		var codeText = message.data.text;  // holds the encoded text
		words = message.data.words;
		verbs = message.data.verbs;
		var values = {};  // keeps track of data related to the code symbols (appearances, possibilities, and strikes)
		var strikeOut = 1;  // the number of strikes against a character it takes to have it removed
		S.forEach(codeText, function (character, index) {  // finds all of the unique letters in the text and their locations
			if (character != character.toUpperCase()) {  // if it's a letter
				if (values.hasOwnProperty(character)) {
					values[character].appearances.push(index);
				} else {
					values[character] = { appearances: [index], codeWords: [], possibilities: [], strikes: [] };
				}
			}  //// There needs to be something to handle numbers in {}s.
		});
		/// "values" now has an object for every unique symbol in the encoded text
		/// with an "appearances" property containing indices of appearance for each unique symbol
		codeText = codeText.split(" ").sort(function (a, b) { return a.length - b.length });
		/// "codeText" is now an array in order of increasing word length
		var codeWords = {};  // will hold a list of possible decoded words for every unique word
		S.forEach(codeText, function (word) {
			/// isolate() removes the punctuation from the word
			codeWords[isolate(word)] = [];  // assignment might not work if there's {}s
		});
		/// "codeWords" now has an empty array for every word in the encoded text
		/// and every word in the encoded text is in order of increasing length
		/// (smaller words have less possible words? which is helpful to start with later) ////
		S.forEach(codeWords, function (array, key) {  // finds all of the words with the same letter pattern as the code words
			var standardizedWord = standardize(key);  // Doing this only once (not at every if-statement) speeds things up.
			words[key.length - 1].forEach(function (word) {
				if (standardizedWord == standardize(word)) {
					array.push(word);
				}
			});
		});
		/// "codeWords" now has an array containing a list of all English words with the same letter pattern as their respective word from the encoded text
		Object.keys(values).forEach(function (symbol) {  // for every unique symbol
			S.forEach(codeWords, function (possibleWords, text) {  // for every code word
				if (text.includes(symbol)) {  // if the current code word includes the current symbol
					// for every code word that contains a certain symbol
					values[symbol].codeWords.push(text);  // add the code word to the codeWords list of the symbol
				}
			});
		});
		/// now every symbol in "values" is associated with a list of code words where that symbol is contained
		S.forEach(values, function (properties, symbol) {  // for every unique symbol
			let symbolIndex = properties.codeWords[0].indexOf(symbol);  // where the symbol is in the code word (more than one place isn't needed)
			// adds all letters the symbol could be
			codeWords[properties.codeWords[0]].forEach(function (possibility) {
				if (!values[symbol].possibilities.includes(possibility[symbolIndex])) {
					values[symbol].possibilities.push(possibility[symbolIndex]);
				}
			});
			/// This samples the first code word where the symbol is present and
			/// goes through all of the possible English words associated with the sampled code word.
			/// If the corresponding letter of the English word isn't already listed as a possible symbol decryption,
			/// the letter is added to the possibilities associated with the given symbol.
			/// This creates a preliminary list to work with in the next code block.
		});
		/// now every symbol in "values" has a preliminary set of possible decryptions

		// determines which letters are valid values for each unique symbol in the encoded text across all words
		// (when a symbol never equals a certain letter in any possibility for one word, any possibilities for other words using that letter must be eliminated)
		// (determines what symbol decryptions make sense within words)
		let changed;  // whether any of the following processing has caused a change in the possible words
		do {
			changed = false;
			S.forEach(values, function (properties, symbol) {  // for every unique symbol
				properties.codeWords.forEach(function (word) {  // for every code word that contains the symbol
					// sets the possible decryptions of the current symbol based on the possibilities associated with the code word
					let symbolIndex = word.indexOf(symbol);  // where the symbol is in the code word (more than one place isn't needed)
					let codeLetters = [];  // will hold possible decryptions of the current symbol
					codeWords[word].forEach(function (possibility) {
						if (!codeLetters.includes(possibility[symbolIndex])) {
							codeLetters.push(possibility[symbolIndex]);
						}
					});
					S.forEach(values[symbol].possibilities, function (possibility) {  // This can't use the native array function because I need it to copy.
						if (!codeLetters.includes(possibility)) {
							// remove the possibility from "values"
							values[symbol].possibilities.splice(values[symbol].possibilities.indexOf(possibility), 1);
							// remove the relavent words from "codeWords"
							properties.codeWords.forEach(function (codeWord) {
								let newSymbolIndex = codeWord.indexOf(symbol);
								S.forEach(codeWords[codeWord], function (otherWord) {  // This can't use the native array function because I need it to copy.
									if (otherWord[newSymbolIndex] == possibility) {  // if the code word possibility includes the eliminated letter
										codeWords[codeWord].splice(codeWords[codeWord].indexOf(otherWord), 1);  // remove the possibility from "codeWords"
									}
								}, true);
							});
							changed = true;  // indicates that the possible decryption has changed
						}
					}, true);
				});
			});
		} while (changed)
		/// values now has, for each unique symbol in the encrypted text:
		/// "appearances" corresponding to the indices of the text where the symbol is found (done earlier)
		/// "codeWords" corresponding to the code words that contain the symbol (done earlier)
		/// "possibilities" corresponding to a list of all the letters the symbol could be
		//// "strikes" corresponding to a list of strikes made in the same order as the possibilities indicating the likelihood of a symbol being a certain letter
		///
		/// codeWords now only has words which contain letters that don't have too many strikes against them ////

		// determines whether there's any solution possible
		S.forEach(values, function (properties, symbol) {
			if (properties.possibilities.length == 0) {
				console.warn('The symbol "' + symbol + '" has no possibilities left.');
			}
		});

		codeText = message.data.text.split(" ");
		codeText.forEach(function (word, index) {
			codeText[index] = isolate(word);
		});
		var totalIndexList = [],  // will hold the maximum index of the possibilities for each encoded word
			currentIndexList = [];  // will hold a list of indices corresponding to the current possibility of each word being investigated
		codeText.forEach(function (word) {  // sets totalIndexList and currentIndexList
			totalIndexList.push(codeWords[word].length - 1);
			currentIndexList.push(0);
		});
		var trueFalse = true,  // holds the result of complicated processing which determines whether the following decoding loop should continue
			index = 0,  // which code word is being looked at
			codeKey = {},
			solution;  // the current solution being constructed
		S.forEach(values, function (unnecessary, key) {
			codeKey[key] = undefined;
		});
		console.info("After refining eligible words:"); ////
		let totalPossibilities = 1;
		codeText.forEach(function (word, number) {  //// This logs how many possibilities each word has at this point.
			totalPossibilities *= codeWords[word].length;
			console.info("Possibilities for word " + (number + 1) + " = " + codeWords[word].length);
		});
		console.info("Total possibilites = " + totalPossibilities);
		function usageCheck(letters) {  //// This needs to allow for imperfect matches.
			// makes sure a word doesn't conflict with the letters used in previous words
			let falseTrue = true;
			let changes = [];
			let placement = 0;
			while (placement < letters.length) {  // goes through every letter
				let letter = letters[placement];
				let codeLetter = codeText[index][placement];
				if (codeKey[codeLetter] == undefined || index <= codeKey[codeLetter].maximumIndex) {
					let unused = true;
					let keys = Object.keys(codeKey);
					let codeKeyIndex = 0;
					while (codeKeyIndex < keys.length) {  // checks if the letter is being used in a preceeding word
						let guess = codeKey[keys[codeKeyIndex]];
						if (guess != undefined && guess.letter == letter && guess.maximumIndex < index) {
							unused = false;
							break;
						}
						codeKeyIndex++;
					}
					if (unused) {
						changes.push([codeLetter, letter]);
					} else {
						falseTrue = false;
						break;
					}
				} else if (codeKey[codeLetter].letter != letter) {  //// This could be where you allow for imperfect matches.
					falseTrue = false;
					break;
				}
				placement++;
			}
			if (falseTrue) {  // updates the code key with the letters of the word if it passes
				let changeIndex = 0;
				while (changeIndex < changes.length) {
					codeKey[changes[changeIndex][0]] = { "letter": changes[changeIndex][1], "maximumIndex": index };
					changeIndex++;
				}
			}
			return falseTrue;
		}
		// determines which symbol decryptions work across words
		while (trueFalse) {  // This is the most taxing part of the decoder.
			if (currentIndexList[index] <= totalIndexList[index]) {
				if (usageCheck(codeWords[codeText[index]][currentIndexList[index]])) {  // if the word doesn't conflict with the previously used letters
					if (index < currentIndexList.length - 1) {  // if the index isn't at the end of the array (if every word hasn't been checked yet)
						index++;  // go to the next word of the encoded text
						messenger.progress = (currentIndexList[0] + 1) / (totalIndexList[0] + 1) * 100 - .1;
						self.postMessage(messenger);  // gives the website an update up the progress
					} else {
						solution = [];
						let number = 0;
						while (number < codeText.length) {
							let word = codeText[number];
							solution.push(codeWords[word][currentIndexList[number]]);
							number++;
						}
						if (checkSolution(solution)) {
							solutions.push(solution.join(" "));
						}
						currentIndexList[index]++;
					}
				} else {
					currentIndexList[index]++;
				}
			} else {
				if (index > 0) {
					currentIndexList[index] = 0;
					index--;
					currentIndexList[index]++;
				} else {
					trueFalse = false;
				}
			}
		}
		resolve();
	}).catch(function (error) {
		console.error(error);
		messenger.error = true;
		messenger = JSON.parse(JSON.stringify(messenger));
		self.postMessage(messenger);
	}).then(function () {
		messenger.progress = 100;
		messenger.solutions = solutions;
		messenger.time = Math.round(performance.now() - time) / 1000;
		messenger = JSON.parse(JSON.stringify(messenger));
		self.postMessage(messenger);
		// self.close();  // closes the web worker
	});
});
