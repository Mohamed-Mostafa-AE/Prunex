#pragma once

#include <array>
#include <cstdint>

namespace prunex {

struct ReferencePieceChange {
    int piece;
    int from;
    int to;
};

using ReferencePieceBoards = std::array<std::array<std::uint64_t,7>,2>;
using ReferenceAccumulator = std::array<std::int16_t,512>;

bool loadReferenceNetwork(const char* path);
int evaluateReferenceNetwork(int side,const ReferencePieceBoards& pieces,int* kings,
                             const ReferenceAccumulator* parent,
                             const ReferencePieceChange* changes,int count,
                             ReferenceAccumulator& output);

} // namespace prunex
