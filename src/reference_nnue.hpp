#pragma once

#include <array>
#include <cstdint>

namespace prunex {

struct ReferencePieceChange {
    int piece;
    int from;
    int to;
};

using ReferenceAccumulator = std::array<std::int16_t,512>;

bool loadReferenceNetwork(const char* path);
int evaluateReferenceNetwork(int side,int* pieces,int* squares,
                             const ReferenceAccumulator* parent,
                             const ReferencePieceChange* changes,int count,
                             ReferenceAccumulator& output);

} // namespace prunex
