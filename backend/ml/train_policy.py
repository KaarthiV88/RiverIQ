"""Train the policy network on baseline-labeled data (imitation learning).

The action head is trained with cross-entropy. The sizing head is trained
with MSE, but only on examples where the label is a raise — sizing is
meaningless for fold/check/call.

Run from `backend/`:
    python -m ml.train_policy --data ml/data/train.npz \\
        --out ml/saved_models/policy_v1.pt --epochs 15
"""

import argparse
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from app.bots.policy_net import ACTION_RAISE, PolicyNet


def train(
    data_path: Path,
    out_path: Path,
    epochs: int,
    batch_size: int,
    lr: float,
    sizing_weight: float,
) -> None:
    raw = np.load(data_path)
    features = torch.from_numpy(raw["features"]).float()
    actions = torch.from_numpy(raw["actions"]).long()
    sizings = torch.from_numpy(raw["sizings"]).float()
    n = features.shape[0]
    print(f"Loaded {n} examples ({features.shape[1]} features each).")

    # 90/10 train/val split.
    perm = torch.randperm(n)
    features, actions, sizings = features[perm], actions[perm], sizings[perm]
    split = int(n * 0.9)

    train_ds = TensorDataset(features[:split], actions[:split], sizings[:split])
    val_ds = TensorDataset(features[split:], actions[split:], sizings[split:])
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size)

    model = PolicyNet()
    optim = torch.optim.Adam(model.parameters(), lr=lr)
    ce = nn.CrossEntropyLoss()

    for epoch in range(1, epochs + 1):
        # ── train ──
        model.train()
        epoch_loss = 0.0
        batches = 0
        for x, a, s in train_loader:
            optim.zero_grad()
            logits, sizing_pred = model(x)
            loss_action = ce(logits, a)

            # Sizing loss only for raise labels — masked mean.
            raise_mask = (a == ACTION_RAISE).float()
            n_raises = raise_mask.sum().clamp(min=1.0)
            sizing_err = (sizing_pred.squeeze(-1) - s) ** 2
            loss_sizing = (sizing_err * raise_mask).sum() / n_raises

            loss = loss_action + sizing_weight * loss_sizing
            loss.backward()
            optim.step()

            epoch_loss += loss.item()
            batches += 1

        # ── eval ──
        model.eval()
        correct = 0
        total = 0
        raise_size_err = 0.0
        raise_count = 0
        with torch.no_grad():
            for x, a, s in val_loader:
                logits, sizing_pred = model(x)
                preds = logits.argmax(dim=-1)
                correct += (preds == a).sum().item()
                total += a.numel()
                mask = a == ACTION_RAISE
                if mask.any():
                    raise_size_err += (
                        (sizing_pred.squeeze(-1)[mask] - s[mask]) ** 2
                    ).sum().item()
                    raise_count += int(mask.sum().item())

        acc = correct / max(total, 1)
        rmse = (raise_size_err / max(raise_count, 1)) ** 0.5
        print(
            f"epoch {epoch:2d}/{epochs}  "
            f"train_loss={epoch_loss/max(batches,1):.4f}  "
            f"val_action_acc={acc:.4f}  val_sizing_rmse={rmse:.3f}"
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), out_path)
    print(f"Saved checkpoint → {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=str, default="ml/data/train.npz")
    parser.add_argument("--out", type=str, default="ml/saved_models/policy_v1.pt")
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--sizing-weight", type=float, default=0.5)
    args = parser.parse_args()

    train(
        Path(args.data),
        Path(args.out),
        args.epochs,
        args.batch_size,
        args.lr,
        args.sizing_weight,
    )


if __name__ == "__main__":
    main()
