if(NOT DEFINED ENGINE OR NOT DEFINED SCENARIO)
    message(FATAL_ERROR "ENGINE and SCENARIO are required")
endif()

if(SCENARIO STREQUAL "movetime")
    set(input_file "${CMAKE_CURRENT_LIST_DIR}/uci_movetime.in")
elseif(SCENARIO STREQUAL "clock")
    set(input_file "${CMAKE_CURRENT_LIST_DIR}/uci_clock.in")
else()
    message(FATAL_ERROR "Unknown scenario: ${SCENARIO}")
endif()

execute_process(
    COMMAND "${ENGINE}"
    INPUT_FILE "${input_file}"
    OUTPUT_VARIABLE output
    ERROR_VARIABLE error_output
    RESULT_VARIABLE result
    TIMEOUT 15
)

if(NOT result EQUAL 0)
    message(FATAL_ERROR "Timed UCI process failed: ${result}\n${error_output}")
endif()

if(NOT output MATCHES "bestmove [a-h][1-8][a-h][1-8][qrbn]?")
    message(FATAL_ERROR "Timed UCI search did not return a valid bestmove\n${output}")
endif()
