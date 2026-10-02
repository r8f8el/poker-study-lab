import pytest
from services.poker_engine.range_model import (
    build_range_matrix,
    expand_combo,
    get_combos_for_percentage,
    OPPONENT_PROFILES,
)


def test_build_range_matrix():
    matrix = build_range_matrix()
    assert len(matrix) == 13
    assert len(matrix[0]) == 13
    assert matrix[0][0] == "AA"
    assert matrix[0][1] == "AKs"
    assert matrix[1][0] == "AKo"
    assert matrix[12][12] == "22"


def test_expand_combo():
    # Pocket Aces: 6 pairs with no dead cards
    aa = expand_combo("AA", [])
    assert len(aa) == 6

    # With As dead: 3 pairs
    aa_dead = expand_combo("AA", ["As"])
    assert len(aa_dead) == 3

    # Suited: 4 combos
    aks = expand_combo("AKs", [])
    assert len(aks) == 4

    # Offsuit: 12 combos
    ako = expand_combo("AKo", [])
    assert len(ako) == 12


def test_get_combos_for_percentage():
    combos_10 = get_combos_for_percentage(10)
    assert len(combos_10) == 17
    assert "AA" in combos_10
    assert "KK" in combos_10

    combos_100 = get_combos_for_percentage(100)
    assert len(combos_100) == 169
