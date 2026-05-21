import Card from '../components/Card'
import Avatar from '../components/Avatar'
import PositionMarker from '../components/PositionMarker'
import Chip from '../components/Chip'
import ChipStack from '../components/ChipStack'

export default function Preview() {
  return (
    <div
      className="min-h-screen p-10 text-white"
      style={{ background: 'var(--felt)' }}
    >
      <h1 className="text-3xl font-bold mb-8">RiverIQ — Component Preview</h1>

      {/* Cards */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 opacity-80">Cards</h2>
        <div className="flex flex-wrap items-end gap-4">
          <Card card="Ah" />
          <Card card="Kd" />
          <Card card="Qc" />
          <Card card="Js" />
          <Card card="Td" />
          <Card card="2c" />
          <Card />
          <Card card="Ah" size="sm" />
          <Card card="Ah" size="lg" />
        </div>
      </section>

      {/* Avatars */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 opacity-80">Avatars</h2>
        <div className="flex flex-wrap items-center gap-6">
          <Avatar name="You" isHuman />
          <Avatar name="P. Ivey" />
          <Avatar name="P. Hellmuth" />
          <Avatar name="D. Negreanu" />
          <Avatar name="T. Dwan" />
          <Avatar name="D. Brunson" />
          <Avatar name="Tony G" />
          <Avatar name="Rampage" />
          <Avatar name="Wolfgang" />
        </div>
        <div className="flex items-center gap-4 mt-4">
          <Avatar name="Atlas" size="sm" />
          <Avatar name="Atlas" size="md" />
          <Avatar name="Atlas" size="lg" />
        </div>
      </section>

      {/* Position markers */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 opacity-80">Position Markers</h2>
        <div className="flex items-center gap-4">
          <PositionMarker marker="D" />
          <PositionMarker marker="LB" />
          <PositionMarker marker="BB" />
        </div>
      </section>

      {/* Chips */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 opacity-80">Chips (low → high)</h2>
        <div className="flex items-center gap-4">
          <Chip color="white" />
          <Chip color="red" />
          <Chip color="blue" />
          <Chip color="green" />
          <Chip color="black" />
        </div>
      </section>

      {/* Chip stacks */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 opacity-80">Chip Stacks</h2>
        <div className="flex items-end gap-10">
          <div className="text-center">
            <ChipStack amount={3} />
            <div className="text-xs opacity-60 mt-2">3 (whites)</div>
          </div>
          <div className="text-center">
            <ChipStack amount={47} />
            <div className="text-xs opacity-60 mt-2">47</div>
          </div>
          <div className="text-center">
            <ChipStack amount={250} />
            <div className="text-xs opacity-60 mt-2">250</div>
          </div>
          <div className="text-center">
            <ChipStack amount={1325} />
            <div className="text-xs opacity-60 mt-2">1325</div>
          </div>
          <div className="text-center">
            <ChipStack amount={2000} />
            <div className="text-xs opacity-60 mt-2">2000 (starting)</div>
          </div>
        </div>
      </section>
    </div>
  )
}
