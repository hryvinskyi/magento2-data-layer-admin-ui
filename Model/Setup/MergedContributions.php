<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\MergedContributionsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupContributionsInterface;

/**
 * Puts the registered contributions together in registration order, refusing any clash
 *
 * Two contributions may import the same name from the same file (every plugin shares the shell's modules that way);
 * anything else given twice fails.
 */
class MergedContributions implements MergedContributionsInterface
{
    /**
     * @param SetupContributionsInterface $contributions
     */
    public function __construct(
        private readonly SetupContributionsInterface $contributions
    ) {
    }

    /**
     * @inheritDoc
     *
     * @phpstan-impure The answer follows the locale active when it is read
     */
    public function getPhrases(): array
    {
        $phrases = [];
        foreach ($this->contributions->getContributions() as $contribution) {
            foreach ($contribution->getPhrases() as $key => $text) {
                $this->assertNew('phrase', $key, $phrases);
                $phrases[$key] = $text;
            }
        }

        return $phrases;
    }

    /**
     * @inheritDoc
     *
     * @phpstan-impure The answer follows the locale active when it is read
     */
    public function getText(string $key): string
    {
        return $this->getPhrases()[$key] ?? throw new \LogicException(
            sprintf('No setup contribution gives the phrase "%s".', $key)
        );
    }

    /**
     * @inheritDoc
     */
    public function getPlugins(): array
    {
        $plugins = [];
        foreach ($this->contributions->getContributions() as $contribution) {
            foreach ($contribution->getPlugins() as $id => $module) {
                $this->assertNew('plugin', $id, $plugins);
                $plugins[$id] = ['id' => $id, 'module' => $module];
            }
        }

        return array_values($plugins);
    }

    /**
     * @inheritDoc
     */
    public function getImports(): array
    {
        $imports = [];
        foreach ($this->contributions->getContributions() as $contribution) {
            foreach ($contribution->getImports() as $name => $fileId) {
                if (($imports[$name] ?? $fileId) !== $fileId) {
                    throw new \LogicException(sprintf(
                        'Two setup contributions import "%s" from different files: %s and %s.',
                        $name,
                        $imports[$name],
                        $fileId
                    ));
                }
                $imports[$name] = $fileId;
            }
        }

        return $imports;
    }

    /**
     * @inheritDoc
     */
    public function getExtensionData(): array
    {
        $extensions = [];
        foreach ($this->contributions->getContributions() as $contribution) {
            foreach ($contribution->getExtensionData() as $pluginId => $data) {
                $this->assertNew('plugin data', $pluginId, $extensions);
                $extensions[$pluginId] = $data;
            }
        }

        return $extensions;
    }

    /**
     * Check that no earlier contribution gave the key
     *
     * @param string $what What the key names, for the error
     * @param string $key
     * @param array<mixed> $given What the earlier contributions gave, keyed the same way
     * @return void
     * @throws \LogicException When the key is already given
     */
    private function assertNew(string $what, string $key, array $given): void
    {
        if (array_key_exists($key, $given)) {
            throw new \LogicException(sprintf(
                'Two setup contributions give the %s "%s"; a contribution may not replace another\'s.',
                $what,
                $key
            ));
        }
    }
}
