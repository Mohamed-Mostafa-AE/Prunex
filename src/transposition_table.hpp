// Copyright (c) 2026 Mohamed Mostafa
// SPDX-License-Identifier: MIT
#pragma once

#include <algorithm>
#include <array>
#include <bit>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <new>
#include <vector>

namespace prunex {
#ifndef PRUNEX_TT_BITS
#define PRUNEX_TT_BITS 18
#endif
constexpr int TT_BITS = PRUNEX_TT_BITS;
constexpr std::size_t TT_SIZE = std::size_t{1} << TT_BITS;
constexpr std::size_t TT_WAYS = 2;
constexpr std::size_t TT_BUCKETS = TT_SIZE / TT_WAYS;

enum Bound : std::uint8_t { TT_NONE, TT_EXACT, TT_LOWER, TT_UPPER };

constexpr std::uint16_t TT_NO_MOVE=0xFFFFU;

struct TTEntry {
    std::uint64_t key=0;
    std::uint16_t bestMove=TT_NO_MOVE;
    std::int16_t score=0;
    std::int8_t depth=-1;
    std::uint8_t bound=TT_NONE;
    std::uint8_t generation=0;
    std::uint8_t halfmove=0;
};
static_assert(sizeof(TTEntry)==16);

using TTCluster = std::array<TTEntry, TT_WAYS>;
constexpr std::size_t MEBIBYTE=1024U*1024U;
constexpr std::size_t DEFAULT_TT_BYTES=TT_BUCKETS*sizeof(TTCluster);
constexpr int DEFAULT_HASH_MB=static_cast<int>(
    std::max<std::size_t>(1,(DEFAULT_TT_BYTES+MEBIBYTE-1)/MEBIBYTE));
inline std::vector<TTCluster> transpositionTable(TT_BUCKETS);
inline std::size_t ttBucketCount=TT_BUCKETS;
inline std::size_t ttBucketMask=TT_BUCKETS-1;
inline int configuredHashMB=DEFAULT_HASH_MB;
inline std::uint8_t ttGeneration=0;
constexpr int QSCOUT_TT_DEPTH=-2;

inline void clearTranspositionStorage() {
    for(auto& cluster:transpositionTable) cluster.fill(TTEntry{});
}

inline bool resizeTranspositionStorage(int megabytes) {
    if(megabytes<1||megabytes>4096) return false;
    if(static_cast<std::size_t>(megabytes)>std::numeric_limits<std::size_t>::max()/MEBIBYTE) return false;
    const std::size_t requestedBytes=static_cast<std::size_t>(megabytes)*MEBIBYTE;
    const std::size_t maximumBuckets=requestedBytes/sizeof(TTCluster);
    if(maximumBuckets==0) return false;
    const std::size_t newBucketCount=std::bit_floor(maximumBuckets);
    if(newBucketCount>transpositionTable.max_size()) return false;

    try {
        std::vector<TTCluster> replacement(newBucketCount);
        transpositionTable.swap(replacement);
    } catch(const std::bad_alloc&) {
        return false;
    }

    ttBucketCount=newBucketCount;
    ttBucketMask=newBucketCount-1;
    configuredHashMB=megabytes;
    ttGeneration=0;
    return true;
}

inline const TTEntry* findTranspositionEntry(std::uint64_t key) {
    for(const auto& entry:transpositionTable[key&ttBucketMask]) {
        if(entry.bound!=TT_NONE&&entry.key==key) return &entry;
    }
    return nullptr;
}

inline TTEntry& probeTranspositionTable(std::uint64_t key,bool& found) {
    auto& cluster=transpositionTable[key&ttBucketMask];
    TTEntry* replacement=&cluster.front();
    int replacementQuality=std::numeric_limits<int>::max();

    for(auto& entry:cluster) {
        if(entry.bound!=TT_NONE&&entry.key==key) {
            found=true;
            return entry;
        }
        if(entry.bound==TT_NONE) {
            found=false;
            return entry;
        }

        const int age=static_cast<std::uint8_t>(ttGeneration-entry.generation);
        const int quality=entry.depth-age*8;
        if(quality<replacementQuality) {
            replacementQuality=quality;
            replacement=&entry;
        }
    }

    found=false;
    return *replacement;
}

inline void storeTranspositionEntry(const TTEntry& incoming) {
    bool found=false;
    auto& slot=probeTranspositionTable(incoming.key,found);
    if(incoming.depth==QSCOUT_TT_DEPTH) {
        if(slot.bound!=TT_NONE&&slot.depth!=QSCOUT_TT_DEPTH) return;
    } else if(found&&slot.generation==incoming.generation&&slot.depth>incoming.depth) {
        return;
    }
    slot=incoming;
}

inline int hashFullPermille() {
    constexpr std::size_t sampleEntries=1000;
    constexpr std::size_t maximumSampleClusters=sampleEntries/TT_WAYS;
    const std::size_t sampleClusters=std::min(ttBucketCount,maximumSampleClusters);
    std::size_t used=0;
    for(std::size_t index=0;index<sampleClusters;++index) {
        for(const auto& entry:transpositionTable[index]) {
            if(entry.generation==ttGeneration&&entry.bound!=TT_NONE) ++used;
        }
    }
    const std::size_t sampledEntries=sampleClusters*TT_WAYS;
    return sampledEntries==0?0:static_cast<int>(used*1000/sampledEntries);
}
} // namespace prunex
