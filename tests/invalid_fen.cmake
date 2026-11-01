execute_process(
    COMMAND "${ENGINE}" --perft-fen "${FEN}" 1
    RESULT_VARIABLE result
    OUTPUT_VARIABLE output
    ERROR_VARIABLE error
)
if(NOT result EQUAL 2)
    message(FATAL_ERROR "Expected invalid FEN exit code 2, got '${result}'. Output: ${output} Error: ${error}")
endif()
if(NOT error MATCHES "Invalid FEN")
    message(FATAL_ERROR "Expected 'Invalid FEN' diagnostic. Output: ${output} Error: ${error}")
endif()
