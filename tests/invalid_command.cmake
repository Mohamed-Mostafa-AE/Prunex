if(MODE STREQUAL "perft")
    set(arguments --perft "${DEPTH}")
elseif(MODE STREQUAL "perft_fen")
    set(arguments --perft-fen "8/8/8/8/8/8/4K3/7k w - - 0 1" "${DEPTH}")
elseif(MODE STREQUAL "divide_fen")
    set(arguments --divide-fen "8/8/8/8/8/8/4K3/7k w - - 0 1" "${DEPTH}")
else()
    message(FATAL_ERROR "Unknown mode: ${MODE}")
endif()
execute_process(
    COMMAND "${ENGINE}" ${arguments}
    RESULT_VARIABLE result
    OUTPUT_VARIABLE output
    ERROR_VARIABLE error
)
if(NOT result EQUAL 2)
    message(FATAL_ERROR "Expected exit code 2, got '${result}'. Output: ${output} Error: ${error}")
endif()
if(NOT error MATCHES "Invalid depth")
    message(FATAL_ERROR "Expected depth validation error. Output: ${output} Error: ${error}")
endif()
