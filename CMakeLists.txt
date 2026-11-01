cmake_minimum_required(VERSION 3.20)
project(Prunex VERSION 0.5.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(prunex src/main.cpp)
target_compile_features(prunex PRIVATE cxx_std_20)

if(WIN32)
    add_executable(PrunexGUI WIN32 src/gui.cpp)
    target_compile_features(PrunexGUI PRIVATE cxx_std_20)
    target_link_libraries(PrunexGUI PRIVATE user32 gdi32)
    set_target_properties(PrunexGUI PROPERTIES OUTPUT_NAME "Prunex")
    set_target_properties(prunex PROPERTIES OUTPUT_NAME "prunex-cli")
endif()

if(MSVC)
    target_compile_options(prunex PRIVATE /W4 /permissive- /utf-8)
    if(TARGET PrunexGUI)
        target_compile_options(PrunexGUI PRIVATE /W4 /permissive- /utf-8)
    endif()
elseif(CMAKE_CXX_COMPILER_ID MATCHES "Clang")
    target_compile_options(prunex PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wshadow -Wno-sign-conversion)
else()
    target_compile_options(prunex PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wshadow)
endif()

include(CTest)

if(BUILD_TESTING)
    add_test(NAME start_position_perft_1 COMMAND prunex --perft 1)
    set_tests_properties(start_position_perft_1 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 1: 20")

    add_test(NAME start_position_perft_2 COMMAND prunex --perft 2)
    set_tests_properties(start_position_perft_2 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 2: 400")

    add_test(NAME start_position_perft_3 COMMAND prunex --perft 3)
    set_tests_properties(start_position_perft_3 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 3: 8902")

    add_test(NAME start_position_perft_4 COMMAND prunex --perft 4)
    set_tests_properties(start_position_perft_4 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 4: 197281")

    set(KIWIPETE "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1")
    add_test(NAME kiwipete_perft_1 COMMAND prunex --perft-fen "${KIWIPETE}" 1)
    set_tests_properties(kiwipete_perft_1 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 1: 48")

    add_test(NAME kiwipete_perft_2 COMMAND prunex --perft-fen "${KIWIPETE}" 2)
    set_tests_properties(kiwipete_perft_2 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 2: 2039")

    add_test(NAME kiwipete_perft_3 COMMAND prunex --perft-fen "${KIWIPETE}" 3)
    set_tests_properties(kiwipete_perft_3 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 3: 97862")

    set(ENDGAME "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1")
    add_test(NAME endgame_perft_1 COMMAND prunex --perft-fen "${ENDGAME}" 1)
    set_tests_properties(endgame_perft_1 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 1: 14")

    add_test(NAME endgame_perft_2 COMMAND prunex --perft-fen "${ENDGAME}" 2)
    set_tests_properties(endgame_perft_2 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 2: 191")

    add_test(NAME endgame_perft_3 COMMAND prunex --perft-fen "${ENDGAME}" 3)
    set_tests_properties(endgame_perft_3 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 3: 2812")

    set(POSITION_3 "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1")
    add_test(NAME position_3_perft_4 COMMAND prunex --perft-fen "${POSITION_3}" 4)
    set_tests_properties(position_3_perft_4 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 4: 43238")

    set(POSITION_4 "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1")
    add_test(NAME position_4_perft_3 COMMAND prunex --perft-fen "${POSITION_4}" 3)
    set_tests_properties(position_4_perft_3 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 3: 9467")

    set(POSITION_5 "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8")
    add_test(NAME position_5_perft_3 COMMAND prunex --perft-fen "${POSITION_5}" 3)
    set_tests_properties(position_5_perft_3 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 3: 62379")

    set(POSITION_6 "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10")
    add_test(NAME position_6_perft_1 COMMAND prunex --perft-fen "${POSITION_6}" 1)
    set_tests_properties(position_6_perft_1 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 1: 46")
    add_test(NAME position_6_perft_2 COMMAND prunex --perft-fen "${POSITION_6}" 2)
    set_tests_properties(position_6_perft_2 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 2: 2079")
    add_test(NAME position_6_perft_3 COMMAND prunex --perft-fen "${POSITION_6}" 3)
    set_tests_properties(position_6_perft_3 PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 3: 89890")

    add_executable(prunex_search_tests tests/search_regression.cpp)
    target_compile_features(prunex_search_tests PRIVATE cxx_std_20)
    if(MSVC)
        target_compile_options(prunex_search_tests PRIVATE /W4 /permissive-)
    elseif(CMAKE_CXX_COMPILER_ID MATCHES "Clang")
        target_compile_options(prunex_search_tests PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wshadow -Wno-sign-conversion)
    else()
        target_compile_options(prunex_search_tests PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wshadow)
    endif()
    add_test(NAME search_checkmate_stalemate_quiet_evasion COMMAND prunex_search_tests)
    add_test(NAME en_passant_white_capture COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DSCENARIO=legal_white -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/en_passant.cmake)
    add_test(NAME en_passant_white_pinned_rejected COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DSCENARIO=pinned_white -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/en_passant.cmake)
    add_test(NAME en_passant_black_capture COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DSCENARIO=legal_black -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/en_passant.cmake)
    add_test(NAME en_passant_black_pinned_rejected COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DSCENARIO=pinned_black -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/en_passant.cmake)

    add_test(NAME uci_smoke COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/uci_smoke.cmake)
    add_test(NAME uci_movetime COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DSCENARIO=movetime -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/uci_timed_search.cmake)
    add_test(NAME uci_clock_time COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DSCENARIO=clock -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/uci_timed_search.cmake)
    add_test(NAME uci_checkmate COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DSCENARIO=checkmate -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/uci_end_positions.cmake)
    add_test(NAME uci_stalemate COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DSCENARIO=stalemate -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/uci_end_positions.cmake)
    add_test(NAME uci_quiet_check_evasion COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DSCENARIO=quiet_evasion -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/uci_end_positions.cmake)
    add_test(NAME perft_depth_zero COMMAND prunex --perft 0)
    set_tests_properties(perft_depth_zero PROPERTIES PASS_REGULAR_EXPRESSION "Perft depth 0: 1")
    add_test(NAME invalid_perft_negative_depth COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DMODE=perft -DDEPTH=-1 -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/invalid_command.cmake)
    add_test(NAME invalid_perft_nonnumeric_depth COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DMODE=perft -DDEPTH=nope -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/invalid_command.cmake)
    add_test(NAME invalid_perft_overflow_depth COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DMODE=perft -DDEPTH=999999999999999999 -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/invalid_command.cmake)
    add_test(NAME invalid_perft_fen_negative_depth COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DMODE=perft_fen -DDEPTH=-1 -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/invalid_command.cmake)
    add_test(NAME invalid_divide_zero_depth COMMAND ${CMAKE_COMMAND} -DENGINE=$<TARGET_FILE:prunex> -DMODE=divide_fen -DDEPTH=0 -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/invalid_command.cmake)
    add_test(NAME invalid_fen_rejected COMMAND prunex --perft-fen "not-a-fen" 1)
    set_tests_properties(invalid_fen_rejected PROPERTIES WILL_FAIL TRUE)

    set(INVALID_FEN_NONNUMERIC_HALFMOVE "8/8/8/8/8/8/4K3/4k3 w - - nope 1")
    set(INVALID_FEN_NONNUMERIC_FULLMOVE "8/8/8/8/8/8/4K3/4k3 w - - 0 nope")
    set(INVALID_FEN_EXTRA_FIELD "8/8/8/8/8/8/4K3/4k3 w - - 0 1 extra")
    set(INVALID_FEN_DUPLICATE_RIGHTS "8/8/8/8/8/8/4K3/4k3 w KK - 0 1")
    set(INVALID_FEN_NEGATIVE_HALFMOVE "8/8/8/8/8/8/4K3/4k3 w - - -1 1")
    set(INVALID_FEN_ZERO_FULLMOVE "8/8/8/8/8/8/4K3/4k3 w - - 0 0")
    set(INVALID_FEN_OVERFLOW_HALFMOVE "8/8/8/8/8/8/4K3/4k3 w - - 2147483648 1")
    set(INVALID_FEN_WRONG_EP_RANK "4k3/8/8/3pP3/8/8/8/4K3 w - d4 0 1")
    set(INVALID_FEN_MISSING_EP_PAWN "4k3/8/8/4P3/8/8/8/4K3 w - d6 0 1")
    set(INVALID_FEN_OCCUPIED_EP_TARGET "4k3/8/3N4/3pP3/8/8/8/4K3 w - d6 0 1")
    foreach(case IN ITEMS NONNUMERIC_HALFMOVE NONNUMERIC_FULLMOVE EXTRA_FIELD DUPLICATE_RIGHTS NEGATIVE_HALFMOVE ZERO_FULLMOVE OVERFLOW_HALFMOVE WRONG_EP_RANK MISSING_EP_PAWN OCCUPIED_EP_TARGET)
        add_test(NAME invalid_fen_${case} COMMAND ${CMAKE_COMMAND}
            -DENGINE=$<TARGET_FILE:prunex>
            -DFEN=${INVALID_FEN_${case}}
            -P ${CMAKE_CURRENT_SOURCE_DIR}/tests/invalid_fen.cmake)
    endforeach()

endif()
