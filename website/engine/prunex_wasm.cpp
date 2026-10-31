#include <algorithm>
#include <cstring>
#include <string>
#include <vector>

#include "bitboard.h"
#include "evaluate.h"
#include "misc.h"
#include "movegen.h"
#include "notation.h"
#include "position.h"
#include "search.h"
#include "thread.h"
#include "tt.h"
#include "ucioption.h"

namespace {
bool prunex_initialized = false;
char best_move_buffer[8] = "0000";
}

extern "C" {

void prunex_init() {
  if (prunex_initialized) return;
  UCI::init(Options);
  Bitboards::init();
  Position::init();
  Bitbases::init_kpk();
  Search::init();
  Eval::init();
  Threads.init();
  TT.set_size(64);
  Options["OwnBook"] = "false";
  Options["Minimum Thinking Time"] = "0";
  prunex_initialized = true;
}

const char* prunex_best_move(const char* fen, int nodes, int depth) {
  std::strcpy(best_move_buffer, "0000");
  if (!prunex_initialized || fen == nullptr) return best_move_buffer;

  Position position(std::string(fen), Options["UCI_Chess960"], Threads.main());
  Search::LimitsType limits;
  limits.nodes = std::max(1000, std::min(nodes, 1000000));
  limits.depth = std::max(1, std::min(depth, 32));
  std::vector<Move> search_moves;
  Search::StateStackPtr setup_states;
  Threads.start_thinking(position, limits, search_moves, setup_states);
  Threads.wait_for_think_finished();

  if (!Search::RootMoves.empty())
    std::strncpy(best_move_buffer, move_to_uci(Search::RootMoves[0].pv[0], false).c_str(), sizeof(best_move_buffer) - 1);
  best_move_buffer[sizeof(best_move_buffer) - 1] = '\0';
  return best_move_buffer;
}

}
