var GAME_NUM_CELLS_PER_SIDE = 15;

var Game = {
	settings: {
		game_lang: "french"
	},

	distribution_data: {},
	current_cells_value: [],
	game_letters_pool: {},

	root_node: null,
	board_node: null,

	players: [],
	current_playing_player: null,



	/***************
	* INIT METHODS *
	****************/

	init: function(app_node_id, players_data) {

		/* Save app_node */
		Game.root_node = document.getElementById(app_node_id);
		if( ! Game.root_node ) {
			console.error("Game.init() expects the id of the root node (the game container) as its first argument.");
			return false;
		}


		/* Generate board node and inner board cells */
		Game.generate_board_node();


		/* Generate info-pane node */
		var info_pane_node = document.createElement('div');
		info_pane_node.setAttribute('id', 'info-pane');

		var info_pane_html = 
			'<div id="info-block-current-turn" class="info-block">'+
				'<h3>Joueur actif</h3>'+
				'<div id="info-current-player-name-value"></div>'+
			'</div>';
		info_pane_node.innerHTML = info_pane_html;
		Game.root_node.appendChild(info_pane_node);

		/* Load current lang letters distribution and score data */
		if( ! Game.load_lang_distribution_data(Game.settings.game_lang) ) {
			return false;
		}


		/* Setup/Reset game_letters_pool */
		for(var letter in Game.distribution_data) {
			Game.game_letters_pool[letter] = Game.distribution_data[letter].availability;
		}


		/* Setup players data */
		if( ! players_data || ! (players_data instanceof Array) || players_data.length < 2 ) {
			console.error("Game.init() expects an array of objects defining players as its second argument. The array must have at least 2 elements.");
			return false;
		}

		Game.players = players_data;

		for(var i = 0; i < Game.players.length; i++) {
			Game.players[i].current_score = 0;
			Game.players[i].letters_pool = [];
		}


		/* Select starting player randomly */
		var starting_player_id = Game.get_random_player_id();
		Game.set_playing_player(starting_player_id);
	
	},

	load_lang_distribution_data: function(lang_slug) {
		if( ! game_letters_data[lang_slug] ) {
			console.error("Trying to load letters distribution data for a non existing language ('"+lang_slug+"')");
			return false;
		}

		Game.distribution_data = game_letters_data[lang_slug];

		return true;
	},

	generate_board_node: function() {
		
		Game.board_node = document.createElement('div');
		Game.board_node.setAttribute('id', 'board');

		var inner_board_html = '<div class="inner-wrapper">';
		
		for(var i = 0; i < GAME_NUM_CELLS_PER_SIDE; i++) {
			for(var j = 0; j < GAME_NUM_CELLS_PER_SIDE; j++) {
				var cell_index = i + j * GAME_NUM_CELLS_PER_SIDE;
				inner_board_html += '<div class="cell" data-index="'+cell_index+'" data-letter=""></div>';
			}

			inner_board_html += '<div style="clear: both;"></div>';
		}

		inner_board_html += '</div>'; // Closing .inner-wrapper

		Game.board_node.innerHTML = inner_board_html;

		Game.root_node.appendChild(Game.board_node);
	},


	/*******************
	* GAMEPLAY METHODS *
	********************/

	get_random_player_id: function() {
		return Math.floor(Math.random() * Game.players.length);
	},

	set_playing_player: function(player_id) {
		Game.current_playing_player = Game.players[player_id];
		document.getElementById('info-current-player-name-value').innerHTML = Game.current_playing_player.name;
	},

	draw_random_letters: function(num_letters_to_draw) {

	}
}