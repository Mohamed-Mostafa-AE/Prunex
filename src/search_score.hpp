// Copyright (c) 2026 Mohamed Mostafa
// SPDX-License-Identifier: MIT
#pragma once

#include <algorithm>
#include <optional>

namespace prunex {
constexpr int INF = 32000;
constexpr int MATE = 30000;
constexpr int MAX_PLY = 128;
constexpr int MATE_SCORE_MIN = MATE - MAX_PLY;
constexpr int STATIC_EVAL_LIMIT = MATE - 1000;
static_assert(STATIC_EVAL_LIMIT < MATE_SCORE_MIN);

constexpr bool isMateScore(int score) {
    return (score >= MATE_SCORE_MIN && score <= MATE)
        || (score <= -MATE_SCORE_MIN && score >= -MATE);
}

constexpr int clampStaticEvaluation(int score) {
    return std::clamp(score, -STATIC_EVAL_LIMIT, STATIC_EVAL_LIMIT);
}

constexpr int matedAtPly(int ply) {
    return -MATE + ply;
}

constexpr int scoreToTable(int score, int ply) {
    if (!isMateScore(score)) return score;
    return score > 0 ? score + ply : score - ply;
}

constexpr int scoreFromTable(int score, int ply) {
    if (!isMateScore(score)) return score;
    return score > 0 ? score - ply : score + ply;
}

constexpr std::optional<int> narrowMateWindow(int ply, int& alpha, int& beta) {
    if (ply == 0) return std::nullopt;

    // A loss can occur here. A win requires at least one legal move.
    const int earliestLoss = matedAtPly(ply);
    const int earliestWin = -matedAtPly(ply + 1);
    if (beta <= earliestLoss) return earliestLoss;
    if (alpha >= earliestWin) return earliestWin;
    alpha = std::max(alpha, earliestLoss);
    beta = std::min(beta, earliestWin);
    return std::nullopt;
}
} // namespace prunex
