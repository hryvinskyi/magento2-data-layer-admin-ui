<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopeIdInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SectionWriterInterface;

/**
 * Records every section save, and refuses one that posts a field it was told to refuse, as a configuration save whose
 * field rules refuse a value writes none of its values
 */
class RecordingSectionWriter implements SectionWriterInterface
{
    /**
     * @var list<array{scope: string, section: string, groups: array<string, mixed>}>
     */
    public array $writes = [];

    /**
     * @var list<array{scope: string, section: string, groups: array<string, mixed>}>
     */
    public array $attempts = [];

    /**
     * @param array<string, \Exception> $refusals The exception thrown when a save posts the field, keyed by its
     *     configuration page path
     */
    public function __construct(
        private readonly array $refusals = []
    ) {
    }

    /**
     * @inheritDoc
     */
    public function write(ScopeIdInterface $scope, string $section, array $groups): void
    {
        $write = ['scope' => $scope->toString(), 'section' => $section, 'groups' => $groups];
        $this->attempts[] = $write;
        foreach ($this->paths($section, $groups) as $path) {
            if (isset($this->refusals[$path])) {
                throw $this->refusals[$path];
            }
        }
        $this->writes[] = $write;
    }

    /**
     * List the configuration page paths of the fields a save posts
     *
     * @param string $prefix
     * @param array<mixed> $groups
     * @return list<string>
     */
    private function paths(string $prefix, array $groups): array
    {
        $paths = [];
        foreach ($groups as $groupId => $group) {
            if (!is_array($group)) {
                continue;
            }
            $groupPath = $prefix . '/' . $groupId;
            foreach (array_keys(is_array($group['fields'] ?? null) ? $group['fields'] : []) as $field) {
                $paths[] = $groupPath . '/' . $field;
            }
            array_push($paths, ...$this->paths($groupPath, is_array($group['groups'] ?? null) ? $group['groups'] : []));
        }

        return $paths;
    }
}
