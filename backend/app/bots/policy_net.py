"""Policy network for poker decisions.

A small feedforward net with two heads:
  - action_head    → 4-way logits over (fold, check, call, raise)
  - sizing_head    → scalar in [0, 4] representing raise amount as a
                     fraction of the current pot (so 1.0 = pot-sized).

Trained via imitation of the heuristic baseline in `baseline.py`. Inference
includes masking of illegal actions (e.g. you can't check when facing a
bet) before the softmax.
"""

import torch
import torch.nn as nn

from .features import FEATURE_DIM

# Action index constants — must match the labels used during training.
ACTION_FOLD = 0
ACTION_CHECK = 1
ACTION_CALL = 2
ACTION_RAISE = 3
NUM_ACTIONS = 4

# Sigmoid output is scaled to this range so the net can express overbets.
SIZING_SCALE = 4.0


class PolicyNet(nn.Module):
    def __init__(self, input_dim: int = FEATURE_DIM, hidden: int = 128) -> None:
        super().__init__()
        self.trunk = nn.Sequential(
            nn.Linear(input_dim, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden // 2),
            nn.ReLU(),
        )
        self.action_head = nn.Linear(hidden // 2, NUM_ACTIONS)
        self.sizing_head = nn.Linear(hidden // 2, 1)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        h = self.trunk(x)
        action_logits = self.action_head(h)
        sizing = torch.sigmoid(self.sizing_head(h)) * SIZING_SCALE
        return action_logits, sizing


def mask_illegal_actions(
    logits: torch.Tensor, *, call_amount: float, can_raise: bool,
) -> torch.Tensor:
    """Set illegal-action logits to -inf so softmax assigns them ~0."""
    masked = logits.clone()
    if call_amount > 0:
        masked[..., ACTION_CHECK] = -1e9
    else:
        masked[..., ACTION_FOLD] = -1e9
        masked[..., ACTION_CALL] = -1e9
    if not can_raise:
        masked[..., ACTION_RAISE] = -1e9
    return masked
