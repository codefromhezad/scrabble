/* How to convert letters distribution for a language
 * 1) Copy HTML code of distribution table for your language
 *    from this URL : https://en.wikipedia.org/wiki/Scrabble_letter_distributions
 *
 * 2) Convert this HTML table to JSON using this service :
 *    http://convertjson.com/html-table-to-json.htm
 *    (Ensure "Always use first row of table as JSON property names" is CHECKED)
 *
 * 3) Paste the resulting JSON array here, using it as the value of the "raw_data" variable.
 *
 * 4) Run parse_and_log_lang_data_from_raw_data() from your browser's console (when browing
 *    the game's page, obviously).
 *
 * 5) Copy the JSON string you see in the console and paste it in the game_letters_data object
 *    (in game_letters_data.js file) using the lang name as the key.
 *    
 *    example:
 * 
 *    var game_letters_data = {
 *       <... Previous data ...>,
 *
 *       "french": {YOUR_JSON_STRING}
 *    }
 */

var raw_data = []; /* Replace this empty array with raw data */

function parse_and_log_lang_data_from_raw_data() {
   var letters_data = {};

   for(var i = 0; i < raw_data.length; i+=1) {

      var score_value = raw_data[i]['FIELD1'];

      for(var availability in raw_data[i]) {

         if( availability == 'FIELD1' ) {
            continue;
         }

         var line_letters = raw_data[i][availability];

         if( line_letters.length ) {
            var int_availability = parseInt(availability.slice(1));
            var line_letters_array = line_letters.split(' ');

            for(var j = 0; j < line_letters_array.length; j++) {
               var current_letter = line_letters_array[j].toLowerCase();

               if( letters_data[current_letter] === undefined ) {
                  letters_data[current_letter] = {};
               }

               letters_data[current_letter].availability = int_availability;
               letters_data[current_letter].score_value = score_value;
            }
         }
      }
   }

   console.log(JSON.stringify(letters_data));
}

