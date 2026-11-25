import { Label } from "@/components/Label";
import { IconSelector } from "@tabler/icons-react";import {
  Box,
  CheckIcon,
  Combobox,
  Group,
  Input,
  Pill,
  PillsInput,
  rem,
  useCombobox,
} from "@mantine/core";

export default function LabelsDropdown({ items, selected, onChange, disabled = false, ...props }) {
  const isDisabled = disabled || !can("edit task");
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex("active"),
  });

  const handleValueSelect = (val) => {
    if (isDisabled) return;
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  };

  const handleValueRemove = (val) => {
    if (isDisabled) return;
    onChange(selected.filter((v) => v !== val));
  };

  return (
    <Box {...props} style={isDisabled ? { pointerEvents: "none", opacity: 0.7 } : undefined}>
      <Input.Label>Etiquetas</Input.Label>
      <Combobox
        store={combobox}
        onOptionSubmit={handleValueSelect}
        withinPortal={false}
        disabled={isDisabled}
      >
        <Combobox.DropdownTarget>
              <PillsInput
                pointer={!isDisabled}
                disabled={isDisabled}
                tabIndex={isDisabled ? -1 : undefined}
                onClick={() => !isDisabled && combobox.toggleDropdown()}
                rightSection={
                  isDisabled ? null : (
                    <IconSelector
                      size={14}
                      stroke={1.5}
                      color="var(--mantine-color-dimmed)"
                    />
                  )
                }
                rightSectionPointerEvents="none"
              >
              <Pill.Group style={{ rowGap: rem(3), columnGap: rem(12) }}>
              {selected.length > 0 ? (
                selected.map((id) => {
                  const label = items.find((i) => i.id === id);
                  if (!label) return null;

                  return (
                    <Label
                      key={label.id}
                      name={label.name}
                      color={label.color}
                      size={11}
                      onRemove={isDisabled ? undefined : () => handleValueRemove(label)}
                    />
                  );
                })
              ) : (
                <Input.Placeholder>Selecciona etiquetas</Input.Placeholder>
              )}

              <Combobox.EventsTarget>
                <PillsInput.Field
                  type="hidden"
                  onBlur={() => combobox.closeDropdown()}
                  onKeyDown={(event) => {
                    if (event.key === "Backspace") {
                      event.preventDefault();
                      handleValueRemove(selected[selected.length - 1]);
                    }
                  }}
                />
              </Combobox.EventsTarget>
            </Pill.Group>
          </PillsInput>
        </Combobox.DropdownTarget>

        <Combobox.Dropdown>
          <Combobox.Options>
            {items.map((label) => (
              <Combobox.Option value={label.id} key={label.id} active={selected.includes(label.id)}>
                <Group gap="sm">
                  {selected.includes(label.id) ? <CheckIcon size={12} /> : null}
                  <Group gap={7}>
                    <Label
                      name={label.name}
                      color={label.color}
                      size={11}
                      onRemove={() => handleValueRemove(label)}
                    />
                  </Group>
                </Group>
              </Combobox.Option>
            ))}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
    </Box>
  );
}
