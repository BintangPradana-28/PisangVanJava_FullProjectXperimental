import type { Meta, StoryObj } from '@storybook/react'
import { Heart } from 'lucide-react'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link']
    },
    size: {
      control: 'select',
      options: ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg']
    },
    disabled: { control: 'boolean' }
  }
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {
  args: { children: 'Pesan Sekarang', variant: 'default' }
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="default">Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  )
}

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra Small</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Suka">
        <Heart />
      </Button>
    </div>
  )
}

export const Disabled: Story = {
  args: { children: 'Tidak tersedia', disabled: true }
}

export const IconOnly: Story = {
  args: {
    size: 'icon',
    'aria-label': 'Tambah ke favorit',
    children: <Heart />
  }
}
