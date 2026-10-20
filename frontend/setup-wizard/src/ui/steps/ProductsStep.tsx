/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The "Products and prices" step: which product data and prices the events carry, in cards of related settings,
 * with a preview of the event beside them that follows every change.
 *
 * Labels and options come from the setting definitions the server sent, so the step shows only the settings the
 * page state holds, in the order below. A purchase-value setting that does not apply (tax can be deducted only from
 * a grand total) is not shown.
 */
import type { JSX } from 'preact';
import {
    Card,
    Columns,
    deductTaxApplies,
    flagOf,
    RadioCards,
    requireSettingKey,
    SelectInput,
    SettingField,
    Switch,
    textOf,
    useSetting,
    useT,
    useWizard,
    type FieldControl,
    type IconName,
    type SettingBinding,
    type SettingKey,
    type SettingsView,
    type StepBehaviour,
} from '@hryvinskyi/datalayer-setup';
import { EventPreview } from '../preview/EventPreview.tsx';

type Control = 'select' | 'switch' | 'radios';

interface FieldSpec {
    readonly key: SettingKey;
    readonly control: Control;
    /** Whether the field has a help line (`field.<key>.help`). */
    readonly help: boolean;
    /** Shown only while this holds; always, when left out. */
    readonly shownWhen?: (view: SettingsView) => boolean;
}

interface CardSpec {
    readonly id: string;
    readonly icon: IconName;
    /** The phrase key of the card's title. */
    readonly title: string;
    readonly fields: readonly FieldSpec[];
}

const PURCHASE_VALUE = requireSettingKey('purchase_value');

const CARDS: readonly CardSpec[] = Object.freeze([
    {
        id: 'items',
        icon: 'inventory_2',
        title: 'products.card.items',
        fields: [
            { key: requireSettingKey('item_id'), control: 'select', help: true },
            { key: requireSettingKey('brand'), control: 'select', help: true },
        ],
    },
    {
        id: 'prices',
        icon: 'percent',
        title: 'products.card.prices',
        fields: [
            { key: requireSettingKey('tax_catalog'), control: 'switch', help: true },
            { key: requireSettingKey('tax_cart'), control: 'switch', help: true },
            { key: requireSettingKey('hidden_price'), control: 'select', help: true },
        ],
    },
    {
        id: 'values',
        icon: 'payments',
        title: 'products.card.values',
        fields: [
            { key: PURCHASE_VALUE, control: 'radios', help: true },
            {
                key: requireSettingKey('deduct_tax'),
                control: 'switch',
                help: false,
                shownWhen: (view) => deductTaxApplies(view.value(PURCHASE_VALUE)),
            },
            { key: requireSettingKey('include_tax'), control: 'switch', help: false },
            { key: requireSettingKey('include_shipping'), control: 'switch', help: false },
            { key: requireSettingKey('checkout_value'), control: 'radios', help: true },
        ],
    },
    {
        id: 'lists',
        icon: 'view_list',
        title: 'products.card.lists',
        fields: [{ key: requireSettingKey('list_view'), control: 'select', help: true }],
    },
]);

interface ControlKit {
    /** Whether the field's label is a `<label for>` of the control; a radio group names itself. */
    readonly labelFor: boolean;
    readonly render: (setting: SettingBinding, control: FieldControl) => JSX.Element;
}

/** How each kind of control draws a setting. */
const CONTROLS: { readonly [C in Control]: ControlKit } = {
    select: {
        labelFor: true,
        render: (setting, control) => (
            <SelectInput
                id={control.id}
                value={textOf(setting.value)}
                options={setting.definition.options}
                onChange={setting.set}
                disabled={control.disabled}
                invalid={control.invalid}
                describedBy={control.describedBy}
            />
        ),
    },
    switch: {
        labelFor: true,
        render: (setting, control) => (
            <Switch
                id={control.id}
                checked={flagOf(setting.value)}
                onChange={setting.set}
                disabled={control.disabled}
                describedBy={control.describedBy}
            />
        ),
    },
    radios: {
        labelFor: false,
        render: (setting, control) => (
            <RadioCards
                name={control.id}
                label={setting.definition.label}
                variant="plain"
                direction="row"
                value={textOf(setting.value)}
                options={setting.definition.options}
                onChange={setting.set}
                disabled={control.disabled}
                describedBy={control.describedBy}
            />
        ),
    },
};

function ProductField({ spec }: { readonly spec: FieldSpec }): JSX.Element {
    const { t } = useT();
    const setting = useSetting(spec.key);
    const kit = CONTROLS[spec.control];
    return (
        <SettingField setting={setting} labelFor={kit.labelFor} help={spec.help ? t(`field.${spec.key}.help`) : undefined}>
            {(control) => kit.render(setting, control)}
        </SettingField>
    );
}

/** The fields of a card that the page state holds and that apply now. */
const shownFields = (card: CardSpec, view: SettingsView): readonly FieldSpec[] =>
    card.fields.filter((field) => view.definition(field.key) !== undefined && (field.shownWhen?.(view) ?? true));

export function ProductsStep(): JSX.Element {
    const { t } = useT();
    const { view } = useWizard();
    return (
        <Columns aside={<EventPreview />}>
            {CARDS.map((card) => {
                const fields = shownFields(card, view);
                return fields.length === 0 ? null : (
                    <Card key={card.id} icon={card.icon} title={t(card.title)}>
                        {fields.map((field) => <ProductField key={field.key} spec={field} />)}
                    </Card>
                );
            })}
        </Columns>
    );
}

/** What this step contributes when the shell registers it. */
export const productsStep: StepBehaviour = { component: ProductsStep };
