<?php

/* Expected $_POST data :
 * 'lang' : aspell's dictionary lang code (eg: 'fr', 'en', ..)
 * 'word' : word to spell-check
 *
 * Returns JSON object containing:
 *	"status": 'valid' if word is valid, 
 *		  	  'invalid' if not and,
 *			  'error' if an error occured from the server, from aspell or from the $_POST data validation
 *  "message": '' (empty string) if no error occured or
 *			   '<error message>' if an error occured.
 */


define('ASPELL_PATH', '/usr/local/bin/aspell');



/* Switch between POST and GET to help debugging */
$input_data = $_GET;



/* Define mandatory input data */
$expected_input_params = array('lang', 'word');



/* Helper to stop processing and send JSON data */
function send_return_data($status, $message = "") {
	header('Content-type:application/json;charset=utf-8');
	echo json_encode(array(
		"status" => $status,
		"message" => $message
	));
	die;
}



/* Check input parameters and sanitize their value for passing to bash script */
$processed_input_data = array();
foreach ($input_data as $input_param_name => $input_param_value) {
	if( in_array($input_param_name, $expected_input_params) ) {
		$input_param_value = str_replace('"', "", $input_param_value);
		$input_param_value = str_replace("'", "", $input_param_value);
		$processed_input_data[$input_param_name] = escapeshellcmd($input_param_value);
	} else {
		send_return_data('error', $input_param_name.' is not a valid parameter for the spell-checker');
	}
}

if( count($processed_input_data) != count($expected_input_params) ) {
	send_return_data('error', 'Missing parameters for the spell-checker');
}



/* Get a list of installed aspell dicts */
$aspell_dicts = shell_exec(ASPELL_PATH.' dump dicts 2>&1');

if( ! $aspell_dicts ) {
	send_return_data('error', '[aspell] An error occured while running the binary.');
}

$aspell_dicts_list = array_filter(explode("\n", $aspell_dicts));
if( ! count( $aspell_dicts_list ) ) {
	send_return_data('error', '[aspell] An error occured while running the binary.');
}

/* Check selected lang is in aspell's available dicts */
if( ! in_array($processed_input_data['lang'], $aspell_dicts_list) ) {
	send_return_data('error', '[aspell] Can\'t find a dictionary for the lang "'.$processed_input_data['lang'].'".');
}

/* Run aspell command */
$aspell_data = shell_exec('echo "'.$processed_input_data['word'].'" | '.ASPELL_PATH.' -a -d '.$processed_input_data['lang'].' 2>&1');

if( ! $aspell_data ) {
	send_return_data('error', '[aspell] An error occured while running the binary.');
}

$aspell_data_lines = array_filter(explode("\n", $aspell_data));
if( ! count( $aspell_data_lines ) ) {
	send_return_data('error', '[aspell] An error occured while running the binary.');
}

/* Check return value comes from Aspell. If not returns Bash error as-is */
if( $aspell_data_lines[0][0] != "@" ) {
	send_return_data('error', $aspell_data_lines[0]);
}

/* Finally check provided word is valid in selected lang or not ! */
if( $aspell_data_lines[1][0] == "&" ) {
	send_return_data('invalid');
} elseif( $aspell_data_lines[1][0] == "*" ) {
	send_return_data('valid');
} else {
	send_return_data('error', '[aspell] Unrecognized response : ' . $aspell_data_lines[1]);
}


/* If script hasn't returned data by now, something super weird happened */
send_return_data('error', 'Well, this error should never appear, that\'s incredibly weird :/');

