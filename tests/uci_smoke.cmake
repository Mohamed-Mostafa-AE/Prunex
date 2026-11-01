if(NOT DEFINED ENGINE)
    message(FATAL_ERROR "ENGINE path was not provided")
endif()

execute_process(
    COMMAND "${ENGINE}"
    INPUT_FILE "${CMAKE_CURRENT_LIST_DIR}/uci_smoke.in"
    OUTPUT_VARIABLE output
    ERROR_VARIABLE error_output
    RESULT_VARIABLE result
    TIMEOUT 15
)

if(NOT result EQUAL 0)
    message(FATAL_ERROR "UCI process failed: ${result}\n${error_output}")
endif()

foreach(expected "id name Prunex 0.5.1" "uciok" "readyok")
    if(NOT output MATCHES "${expected}")
        message(FATAL_ERROR "UCI output is missing '${expected}'\n${output}")
    endif()
endforeach()

if(NOT output MATCHES "bestmove [a-h][1-8][a-h][1-8][qrbn]?")
    message(FATAL_ERROR "UCI output did not contain a valid coordinate bestmove\n${output}")
endif()
