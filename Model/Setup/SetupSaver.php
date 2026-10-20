<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ConfigFieldPathInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ConfigGroupsBuilderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopedValuesInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopeIdInterfaceFactory;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopedValuesReaderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SectionWriterInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingAccessInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingFieldsPoolInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupSaverInterface;
use Magento\Framework\Exception\LocalizedException;
use Psr\Log\LoggerInterface;

/**
 * Checks the whole request, then saves it with one configuration save per scope
 *
 * Every configuration save re-reads the configuration every process shares, twice, and announces the section's change,
 * so a scope's changes are saved together: default first, then websites, then store views, each scope's changes in
 * request order. When a scope's save fails, its changes are saved again one by one, so each reports its own outcome and
 * the others still land. That repeat is safe: a save removes its inherited rows before it writes, a refused value
 * undoes only the writes, and removing a row that is already gone does nothing.
 *
 * A change of a setting the signed-in user may not change refuses the whole request, as an unknown setting does. A
 * change the deployment configuration fixes at its scope is not attempted. A refusal by a setting's save rules is
 * reported in its own words; anything else is logged and reported as a generic failure.
 *
 * @phpstan-import-type Result from SetupSaverInterface
 * @phpstan-import-type ScopeType from ScopeTreeInterface
 * @phpstan-import-type Field from ConfigGroupsBuilderInterface
 * @phpstan-type Change array{scope: string, key: string, op: 'set'|'inherit', value: mixed}
 * @phpstan-type Prepared array{scope: string, key: string, lock: string|null, fields: list<Field>}
 */
class SetupSaver implements SetupSaverInterface
{
    private const SCOPE_ORDER = ['default', 'website', 'store'];

    /**
     * @param SettingFieldsPoolInterface $settingFields
     * @param ScopedValuesReaderInterface $valuesReader
     * @param ConfigFieldPathInterface $fieldPath
     * @param ConfigGroupsBuilderInterface $groupsBuilder
     * @param SectionWriterInterface $sectionWriter
     * @param ScopeIdInterfaceFactory $scopeIdFactory
     * @param LoggerInterface $logger
     * @param SettingAccessInterface $access
     */
    public function __construct(
        private readonly SettingFieldsPoolInterface $settingFields,
        private readonly ScopedValuesReaderInterface $valuesReader,
        private readonly ConfigFieldPathInterface $fieldPath,
        private readonly ConfigGroupsBuilderInterface $groupsBuilder,
        private readonly SectionWriterInterface $sectionWriter,
        private readonly ScopeIdInterfaceFactory $scopeIdFactory,
        private readonly LoggerInterface $logger,
        private readonly SettingAccessInterface $access
    ) {
    }

    /**
     * @inheritDoc
     */
    public function save(array $changes): array
    {
        $parsed = $this->parseAll($changes);
        $reaches = [];
        $paths = [];
        foreach ($parsed as $change) {
            $key = $change['key'];
            $reaches[$key] ??= $this->reachesOf($key);
            array_push($paths, ...array_keys($reaches[$key]));
        }
        $values = $this->valuesReader->read(array_values(array_unique($paths)));
        $prepared = [];
        foreach ($parsed as $index => $change) {
            $prepared[$index] = $this->prepare($change, $reaches[$change['key']], $values);
        }

        $results = [];
        foreach ($this->byScope($prepared, $values) as $scopeId => $indexes) {
            $attempted = [];
            foreach ($indexes as $index) {
                $lock = $prepared[$index]['lock'];
                if ($lock !== null) {
                    $results[$index] = $this->failed($prepared[$index], $lock);
                    continue;
                }
                $attempted[$index] = $prepared[$index];
            }
            $results = array_replace($results, $this->saveScope($scopeId, $attempted));
        }
        ksort($results);

        return array_values($results);
    }

    /**
     * Get the reach of each of a setting's paths, refusing a setting the user may not change
     *
     * @param string $key
     * @return array<string, ScopeType> Keyed by config path
     * @throws InvalidSetupRequestException When no setting is registered under the key, or the user may not change it
     */
    private function reachesOf(string $key): array
    {
        $reaches = $this->settingFields->get($key)->getReaches($key);
        foreach (array_keys($reaches) as $path) {
            if (!$this->access->isAllowed($path)) {
                throw new InvalidSetupRequestException(__('You are not allowed to change the setting "%1".', $key));
            }
        }

        return $reaches;
    }

    /**
     * Read every change of the request
     *
     * @param array<mixed> $changes
     * @return array<int, Change> Keyed by the change's position in the request
     * @throws InvalidSetupRequestException When a change is not of the expected shape, or one setting is changed twice
     *     at one scope
     */
    private function parseAll(array $changes): array
    {
        $parsed = [];
        $seen = [];
        foreach (array_values($changes) as $index => $change) {
            $parsed[$index] = $this->parse($change);
            $id = $parsed[$index]['scope'] . "\n" . $parsed[$index]['key'];
            if (isset($seen[$id])) {
                throw new InvalidSetupRequestException(__(
                    'The setting "%1" is changed twice at the scope %2.',
                    $parsed[$index]['key'],
                    $parsed[$index]['scope']
                ));
            }
            $seen[$id] = true;
        }

        return $parsed;
    }

    /**
     * Read one change of the request
     *
     * @param mixed $change
     * @return Change
     * @throws InvalidSetupRequestException When the change is not of the expected shape
     */
    private function parse(mixed $change): array
    {
        if (!is_array($change) || !is_string($change['scope'] ?? null) || !is_string($change['key'] ?? null)
            || !is_string($change['op'] ?? null)
        ) {
            throw new InvalidSetupRequestException(
                __('Each change needs a scope, a setting and whether it sets a value or inherits it.')
            );
        }
        $op = $change['op'];
        if ($op !== 'set' && $op !== 'inherit') {
            throw new InvalidSetupRequestException(
                __('"%1" is not a change: a change either sets a value or inherits it.', $op)
            );
        }
        if ($op === 'set' && !array_key_exists('value', $change)) {
            throw new InvalidSetupRequestException(
                __('The change of "%1" sets no value.', $change['key'])
            );
        }

        return ['scope' => $change['scope'], 'key' => $change['key'], 'op' => $op, 'value' => $change['value'] ?? null];
    }

    /**
     * Check one change against the scope tree and the setting, and work out the fields it posts
     *
     * @param Change $change
     * @param array<string,ScopeType> $reaches The reach of each of the setting's paths
     * @param ScopedValuesInterface $values
     * @return Prepared
     * @throws InvalidSetupRequestException When the scope is unknown, out of the setting's reach, the default scope for
     *     an inherit, or the value is not one the setting takes
     */
    private function prepare(array $change, array $reaches, ScopedValuesInterface $values): array
    {
        $scopeId = $change['scope'];
        $key = $change['key'];
        if ($values->getType($scopeId) === null) {
            throw new InvalidSetupRequestException(__('The scope "%1" does not exist.', $scopeId));
        }
        foreach ($reaches as $reach) {
            if (!$values->reaches($scopeId, $reach)) {
                throw new InvalidSetupRequestException(
                    __('The setting "%1" cannot be set at the scope %2.', $key, $scopeId)
                );
            }
        }
        if ($change['op'] === 'inherit' && $scopeId === ScopeTreeInterface::DEFAULT_SCOPE) {
            throw new InvalidSetupRequestException(
                __('The default scope has nothing to inherit "%1" from.', $key)
            );
        }

        $posted = $change['op'] === 'set'
            ? array_map(
                static fn (mixed $value): array => ['value' => $value],
                $this->settingFields->get($key)->toFieldValues($key, $change['value'], $scopeId, $values)
            )
            : array_fill_keys(array_keys($reaches), ['inherit' => 1]);
        $fields = [];
        foreach ($posted as $path => $field) {
            $fields[] = ['path' => $this->fieldPath->locate((string) $path), 'field' => $field];
        }

        return [
            'scope' => $scopeId,
            'key' => $key,
            'lock' => $values->getLocks($reaches)[$scopeId] ?? null,
            'fields' => $fields,
        ];
    }

    /**
     * Group the changes by scope: default first, then websites, then store views, each in scope tree order
     *
     * @param array<int,Prepared> $prepared
     * @param ScopedValuesInterface $values
     * @return array<string, list<int>> The positions of each scope's changes in request order, keyed by scope id
     */
    private function byScope(array $prepared, ScopedValuesInterface $values): array
    {
        $positions = [];
        foreach ($prepared as $index => $change) {
            $positions[$change['scope']][] = $index;
        }
        $ordered = [];
        foreach (self::SCOPE_ORDER as $type) {
            foreach ($values->getScopes() as $scope) {
                if ($scope['type'] === $type && isset($positions[$scope['id']])) {
                    $ordered[$scope['id']] = $positions[$scope['id']];
                }
            }
        }

        return $ordered;
    }

    /**
     * Save a scope's changes together, falling back to one by one when that fails
     *
     * @param string $scopeId
     * @param array<int,Prepared> $changes Keyed by position in the request
     * @return array<int, Result> Keyed by position in the request
     */
    private function saveScope(string $scopeId, array $changes): array
    {
        if ($changes === []) {
            return [];
        }
        if (count($changes) > 1 && $this->saveTogether($scopeId, $changes)) {
            return array_map(fn (array $change): array => $this->saved($change), $changes);
        }

        $results = [];
        foreach ($changes as $index => $change) {
            $results[$index] = $this->saveOne($scopeId, $index, $change);
        }

        return $results;
    }

    /**
     * Save a scope's changes in one save
     *
     * A refusal by a setting's rules is expected and left to the one-by-one saves to report; anything else is logged.
     *
     * @param string $scopeId
     * @param array<int,Prepared> $changes Keyed by position in the request
     * @return bool Whether every change was saved
     */
    private function saveTogether(string $scopeId, array $changes): bool
    {
        try {
            $this->write($scopeId, $changes);
        } catch (LocalizedException) {
            return false;
        } catch (\Throwable $exception) {
            $this->logger->warning(
                'Saving the setup wizard changes of a scope together failed; saving them one by one.',
                ['scope' => $scopeId, 'exception' => $exception]
            );

            return false;
        }

        return true;
    }

    /**
     * Save one change on its own
     *
     * @param string $scopeId
     * @param int $index
     * @param Prepared $change
     * @return Result
     */
    private function saveOne(string $scopeId, int $index, array $change): array
    {
        try {
            $this->write($scopeId, [$index => $change]);
        } catch (LocalizedException $exception) {
            return $this->failed($change, $exception->getMessage());
        } catch (\Throwable $exception) {
            $this->logger->error(
                'A setup wizard change could not be saved.',
                ['scope' => $scopeId, 'key' => $change['key'], 'exception' => $exception]
            );

            return $this->failed($change, (string) __('This setting could not be saved. Details are in the log.'));
        }

        return $this->saved($change);
    }

    /**
     * Write changes of one scope, one configuration save per section
     *
     * @param string $scopeId
     * @param array<int,Prepared> $changes
     * @return void
     * @throws LocalizedException When a setting refuses its value
     * @throws \Exception When the save fails otherwise
     */
    private function write(string $scopeId, array $changes): void
    {
        $fields = [];
        foreach ($changes as $change) {
            array_push($fields, ...$change['fields']);
        }
        $scope = $this->scopeIdFactory->create(['value' => $scopeId]);
        foreach ($this->groupsBuilder->build($fields) as $section => $groups) {
            $this->sectionWriter->write($scope, $section, $groups);
        }
    }

    /**
     * Report a change as saved
     *
     * @param Prepared $change
     * @return Result
     */
    private function saved(array $change): array
    {
        return ['scope' => $change['scope'], 'key' => $change['key'], 'status' => 'saved'];
    }

    /**
     * Report a change as failed
     *
     * @param Prepared $change
     * @param string $message For the person saving
     * @return Result
     */
    private function failed(array $change, string $message): array
    {
        return ['scope' => $change['scope'], 'key' => $change['key'], 'status' => 'failed', 'message' => $message];
    }
}
