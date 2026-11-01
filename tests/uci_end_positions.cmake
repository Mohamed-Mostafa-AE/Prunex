if(SCENARIO STREQUAL "checkmate")
    set(input "position fen 7k/6Q1/5K2/8/8/8/8/8 b - - 0 1\ngo depth 1\nquit\n")
    set(expected "bestmove 0000")
elseif(SCENARIO STREQUAL "stalemate")
    set(input "position fen 7k/5Q2/5K2/8/8/8/8/8 b - - 0 1\ngo depth 1\nquit\n")
    set(expected "bestmove 0000")
elseif(SCENARIO STREQUAL "quiet_evasion")
    set(input "position fen 4k3/8/8/8/8/8/8/K3R3 b - - 0 1\ngo depth 2\nquit\n")
    set(expected "bestmove e8(d8|f8|d7|f7)")
else()
    message(FATAL_ERROR "Unknown scenario: ${SCENARIO}")
endif()

set(input_file "${CMAKE_CURRENT_BINARY_DIR}/uci_${SCENARIO}.in")
file(WRITE "${input_file}" "${input}")
execute_process(
    COMMAND "${ENGINE}"
    INPUT_FILE "${input_file}"
    RESULT_VARIABLE result
    OUTPUT_VARIABLE output
    ERROR_VARIABLE error
)
if(NOT result EQUAL 0)
    message(FATAL_ERROR "Engine failed for ${SCENARIO}: ${result}; ${error}")
endif()
if(NOT output MATCHES "${expected}")
    message(FATAL_ERROR "Unexpected UCI response for ${SCENARIO}. Expected '${expected}'. Output: ${output}; Error: ${error}")
endif()
