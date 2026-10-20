<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ConfigGroupsBuilderInterface;

/**
 * Builds the `groups` of each section from configuration page paths, nesting groups as the configuration model's own
 * path setter does
 */
class ConfigGroupsBuilder implements ConfigGroupsBuilderInterface
{
    /**
     * @inheritDoc
     */
    public function build(array $fields): array
    {
        $sections = [];
        foreach ($fields as $entry) {
            $parts = explode('/', $entry['path']);
            if (count($parts) < 3 || in_array('', $parts, true)) {
                throw new \InvalidArgumentException(sprintf(
                    '"%s" is not a configuration page path: it needs a section, a group and a field.',
                    $entry['path']
                ));
            }
            $section = (string) array_shift($parts);
            $field = (string) array_pop($parts);
            $sections[$section] = $this->place($sections[$section] ?? [], $parts, $field, $entry['field']);
        }

        return $sections;
    }

    /**
     * Put a field's data into the group a list of group ids leads to, creating the groups on the way
     *
     * @param array<mixed> $groups The groups at this level, keyed by group id
     * @param list<string> $groupIds The ids of the groups leading to the field, outermost first; never empty
     * @param string $field
     * @param array<string,mixed> $data
     * @return array<string, mixed>
     */
    private function place(array $groups, array $groupIds, string $field, array $data): array
    {
        $groupId = (string) array_shift($groupIds);
        $group = is_array($groups[$groupId] ?? null) ? $groups[$groupId] : [];
        if ($groupIds !== []) {
            $nested = is_array($group['groups'] ?? null) ? $group['groups'] : [];
            $group['groups'] = $this->place($nested, $groupIds, $field, $data);
            $groups[$groupId] = $group;

            return $this->keyed($groups);
        }
        $fields = is_array($group['fields'] ?? null) ? $group['fields'] : [];
        $fields[$field] = $data;
        $group['fields'] = $fields;
        $groups[$groupId] = $group;

        return $this->keyed($groups);
    }

    /**
     * Key a level of groups by text
     *
     * @param array<mixed> $groups
     * @return array<string, mixed>
     */
    private function keyed(array $groups): array
    {
        $keyed = [];
        foreach ($groups as $groupId => $group) {
            $keyed[(string) $groupId] = $group;
        }

        return $keyed;
    }
}
