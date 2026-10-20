<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Nests field values under their configuration page paths the way the configuration page posts its form
 *
 * A path is the field's place on the configuration page, `section/group/field`, with any number of nested groups
 * between the section and the field (`section/group/subgroup/field`); it differs from the stored path for a field that
 * stores its value under another path. Within a group, fields go under `fields` and nested groups under `groups`.
 *
 * @phpstan-type Field array{path: string, field: array<string, mixed>}
 * @api
 */
interface ConfigGroupsBuilderInterface
{
    /**
     * Nest field values under their sections and groups
     *
     * A field given twice keeps the later value.
     *
     * @param list<Field> $fields Each field's configuration page path and the data posted for it, such as
     *     `['value' => …]` or `['inherit' => 1]`
     * @return array<string, array<string, mixed>> The groups of each section, keyed by section id
     * @throws \InvalidArgumentException When a path has fewer than three segments or an empty one
     */
    public function build(array $fields): array;
}
